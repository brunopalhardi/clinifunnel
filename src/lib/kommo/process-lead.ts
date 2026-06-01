import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { KommoClient } from "./client";
import {
  extractUTMsFromCustomFields,
  extractCanalProspeccao,
  extractAppointmentFields,
  extractVendedora,
} from "./utm";
import { classifyChannel } from "@/lib/utils/utm";
import { normalizePhoneBR } from "@/lib/utils/phone";
import { getCreatePatientQueue } from "@/lib/queues";

const log = logger.child({ scope: "process-kommo-lead" });

export interface ProcessLeadClinic {
  id: string;
  kommoSubdomain: string;
  kommoToken: string;
  stageAgendamento: string | null;
}

export interface ProcessLeadInput {
  leadId: string;
  statusId: string;
  pipelineId: string;
  /**
   * Quando setado (backfill), usa esse timestamp como data do agendamento em
   * vez de `now()`. Permite reconstruir o historico real de quando o lead
   * entrou na coluna "Agendado" no Kommo.
   */
  agendamentoAtOverride?: Date;
  /**
   * Quando true (backfill), NAO enfileira criacao de paciente/agendamento no
   * Clinicorp. So recupera o `agendamentoAt` pra metrica, evitando criar
   * agendamentos duplicados pra leads que ja foram atendidos.
   */
  skipPatientCreation?: boolean;
}

async function extractContact(
  kommoClient: KommoClient,
  kommoLead: {
    _embedded?: {
      contacts?: Array<{ id: number }>;
    };
  }
) {
  let phone: string | null = null;
  let email: string | null = null;
  let name: string | null = null;

  const contacts = kommoLead._embedded?.contacts;
  if (!contacts?.length) return { phone, email, name };

  try {
    const contact = await kommoClient.getContact(contacts[0].id);
    // Nome do contato (geralmente completo: "Gabrielle Freitas") tende a ser
    // melhor que o nome do card (curto: "Gabrielle" ou "Lead #N").
    if (contact.name && contact.name.trim()) name = contact.name.trim();
    if (contact.custom_fields_values) {
      for (const field of contact.custom_fields_values) {
        const code = field.field_code?.toUpperCase();
        if (code === "PHONE" && field.values.length > 0) {
          phone = normalizePhoneBR(field.values[0].value);
        }
        if (code === "EMAIL" && field.values.length > 0) {
          email = field.values[0].value;
        }
      }
    }
  } catch (err) {
    log.error({ contactId: contacts[0].id, err }, "failed to fetch contact");
  }

  return { phone, email, name };
}

/**
 * Processa um lead do Kommo (criacao ou mudanca de stage): busca o lead/contato
 * via API, extrai campos e faz upsert no nosso DB. Seta `agendamentoAt` quando o
 * lead atinge o stage de agendamento configurado na clinica.
 *
 * IMPORTANTE: faz chamadas a API do Kommo (getLead/getContact). Sob rajada o
 * Kommo responde 429 — por isso roda DENTRO de um job BullMQ com retry/backoff
 * (worker process-kommo-lead), nao mais sincrono no handler do webhook. Antes,
 * o 429 era engolido e o handler respondia 200, fazendo o Kommo nunca reenviar
 * => agendamento perdido pra sempre.
 *
 * `agendamentoAt` so e gravado na PRIMEIRA vez que vemos o lead em Agendado
 * (ou com um timestamp historico menor, no backfill). Isso mantem a metrica
 * "consultas agendadas por data do evento" correta mesmo com reprocessamento.
 */
export async function processKommoLead(
  clinic: ProcessLeadClinic,
  input: ProcessLeadInput
) {
  const { leadId, statusId, pipelineId, agendamentoAtOverride, skipPatientCreation } = input;

  const kommoClient = new KommoClient(clinic.kommoSubdomain, clinic.kommoToken);
  const kommoLead = await kommoClient.getLead(parseInt(leadId));

  const utms = extractUTMsFromCustomFields(kommoLead.custom_fields_values);
  const canalProspeccao = extractCanalProspeccao(kommoLead.custom_fields_values);
  const vendedora = extractVendedora(kommoLead.custom_fields_values);
  const appointmentFields = extractAppointmentFields(kommoLead.custom_fields_values);
  const channel = classifyChannel(utms);
  const { phone, email, name: contactName } = await extractContact(kommoClient, kommoLead);
  // Prefer nome do contato (completo) ao do card (frequentemente curto).
  const displayName = contactName || kommoLead.name;

  const isAgendamento = Boolean(
    clinic.stageAgendamento && statusId === clinic.stageAgendamento
  );

  const kommoLeadId = String(kommoLead.id);

  // Le o agendamentoAt atual pra so gravar na primeira vez (ou se o historico
  // do backfill for anterior ao que ja temos). Mantem a data do EVENTO, nao a
  // do reprocessamento.
  const existing = await prisma.lead.findUnique({
    where: { clinicId_kommoLeadId: { clinicId: clinic.id, kommoLeadId } },
    select: { agendamentoAt: true },
  });

  const desiredAgendamentoAt = agendamentoAtOverride ?? new Date();
  const shouldSetAgendamento =
    isAgendamento &&
    (existing == null ||
      existing.agendamentoAt == null ||
      desiredAgendamentoAt < existing.agendamentoAt);

  const agendamentoData = shouldSetAgendamento
    ? { agendamentoAt: desiredAgendamentoAt }
    : {};

  const lead = await prisma.lead.upsert({
    where: {
      clinicId_kommoLeadId: { clinicId: clinic.id, kommoLeadId },
    },
    update: {
      name: displayName,
      phone,
      email,
      ...utms,
      canalProspeccao,
      vendedora,
      ...appointmentFields,
      channel,
      kommoStatus: statusId,
      kommoPipelineId: pipelineId,
      ...agendamentoData,
    },
    create: {
      clinicId: clinic.id,
      kommoLeadId,
      name: displayName,
      phone,
      email,
      ...utms,
      canalProspeccao,
      vendedora,
      ...appointmentFields,
      channel,
      kommoStatus: statusId,
      kommoPipelineId: pipelineId,
      kommoCreatedAt: new Date(kommoLead.created_at * 1000),
      ...agendamentoData,
    },
  });

  // Enfileira criacao de paciente quando o lead chega em "Agendado".
  if (isAgendamento && !lead.patientId && !agendamentoAtOverride && !skipPatientCreation) {
    await getCreatePatientQueue().add(
      "create-patient",
      { leadId: lead.id },
      { jobId: `patient-${lead.id}`, attempts: 3, backoff: { type: "exponential", delay: 5000 } }
    );
  }

  return lead;
}
