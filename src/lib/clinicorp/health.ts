/**
 * INT-4: health check da automacao Kommo->Clinicorp.
 *
 * Centraliza a logica de "o que falta pra automacao funcionar 100%" num lugar
 * testavel. Recebe input pre-buscado (Clinic + counts do DB) e retorna lista
 * de checks. UI renderiza, endpoint e fina (so monta input).
 *
 * Por que separar do endpoint: testar I/O e prisma e chato; testar logica de
 * "se token e null e auto-create esta ligado, mostre erro X" e direto.
 */

import {
  hasAppointmentNameKeyword,
  hasTimeNameKeyword,
  isProfessionalField,
} from "@/lib/kommo/utm";
import { parseProfessionalMap } from "./professional-map";
import type { Prisma } from "@prisma/client";

export type CheckStatus = "ok" | "warning" | "error" | "info";

export interface HealthCheck {
  id: string;
  label: string;
  status: CheckStatus;
  message?: string;
}

// Sub-conjunto da Clinic que o health check usa. Evita acoplar em todos os
// campos do model — endpoint busca so o necessario.
export interface HealthClinicInput {
  kommoSubdomain: string | null;
  kommoToken: string | null;
  pipelineId: string | null;
  stageAgendamento: string | null;
  clinicorpUser: string | null;
  clinicorpToken: string | null;
  clinicorpBusinessId: string | null;
  clinicorpAutoCreatePatient: boolean;
  clinicorpWebhookEnabled: boolean;
  professionalMap: Prisma.JsonValue | null;
  lastClinicorpSyncAt: Date | null;
  lastMatchLeadsAt: Date | null;
}

export interface HealthCounts {
  // Webhooks recebidos nas ultimas 24h por origem
  kommoWebhooks24h: number;
  clinicorpWebhooks24h: number;
  // Webhooks com erro nas ultimas 24h (independente de origem)
  errorWebhooks24h: number;
  // Leads e procedures criados nas ultimas 24h (info-only)
  leadsCreated24h: number;
  proceduresCreated24h: number;
}

const SYNC_STALE_MINUTES = 30; // 2x o intervalo de 15min

/**
 * Sec-since-now em minutos. Helper pra mensagens "ha Xmin".
 */
function minutesSince(d: Date | null, now: Date): number | null {
  if (!d) return null;
  return Math.floor((now.getTime() - d.getTime()) / 60_000);
}

export function computeHealthChecks(
  clinic: HealthClinicInput,
  counts: HealthCounts,
  now: Date = new Date(),
): HealthCheck[] {
  const checks: HealthCheck[] = [];

  // ===== Kommo =====
  if (clinic.kommoSubdomain && clinic.kommoToken) {
    checks.push({
      id: "kommo-config",
      label: "Kommo configurado (subdominio + token)",
      status: "ok",
    });
  } else {
    checks.push({
      id: "kommo-config",
      label: "Kommo configurado (subdominio + token)",
      status: "error",
      message: "Faltam credenciais do Kommo. Cadastre em Configuracoes > Integracoes > Kommo.",
    });
  }

  if (clinic.pipelineId && clinic.stageAgendamento) {
    checks.push({
      id: "kommo-pipeline",
      label: "Pipeline e stage 'Agendado' definidos",
      status: "ok",
    });
  } else if (clinic.pipelineId) {
    checks.push({
      id: "kommo-pipeline",
      label: "Pipeline e stage 'Agendado' definidos",
      status: "warning",
      message: "Pipeline OK, mas falta o ID do stage 'Agendado' (sem ele, nao detecta quando o lead foi agendado).",
    });
  } else {
    checks.push({
      id: "kommo-pipeline",
      label: "Pipeline e stage 'Agendado' definidos",
      status: "error",
      message: "Falta o ID do pipeline. Sem isso, nenhum lead e processado.",
    });
  }

  // ===== Clinicorp =====
  if (clinic.clinicorpUser && clinic.clinicorpToken && clinic.clinicorpBusinessId) {
    checks.push({
      id: "clinicorp-config",
      label: "Clinicorp configurado (user + token + business)",
      status: "ok",
    });
  } else {
    checks.push({
      id: "clinicorp-config",
      label: "Clinicorp configurado (user + token + business)",
      status: "error",
      message: "Faltam credenciais do Clinicorp. Cadastre em Configuracoes > Integracoes > Clinicorp.",
    });
  }

  // ===== Flags =====
  checks.push({
    id: "webhook-enabled",
    label: "Webhook Clinicorp ligado",
    status: clinic.clinicorpWebhookEnabled ? "ok" : "warning",
    message: clinic.clinicorpWebhookEnabled
      ? undefined
      : "Webhook desligado. Procedimentos criados no Clinicorp nao vao chegar em tempo real (so pelo sync de 15min).",
  });

  checks.push({
    id: "auto-create-patient",
    label: "Criacao automatica de paciente no Clinicorp",
    status: clinic.clinicorpAutoCreatePatient ? "ok" : "warning",
    message: clinic.clinicorpAutoCreatePatient
      ? undefined
      : "Desligada. Leads agendados no Kommo nao geram paciente automaticamente no Clinicorp.",
  });

  // ===== Mapa de profissionais =====
  const map = parseProfessionalMap(clinic.professionalMap);
  const mapEntries = Object.keys(map).length;
  if (mapEntries === 0) {
    checks.push({
      id: "professional-map",
      label: "Mapa de profissionais cadastrado",
      status: "error",
      message: "Nenhum profissional mapeado. Sem isso, agendamentos nao sabem com qual dentista marcar no Clinicorp. Cadastre em 'Mapa de profissionais'.",
    });
  } else {
    checks.push({
      id: "professional-map",
      label: `Mapa de profissionais cadastrado (${mapEntries} ${mapEntries === 1 ? "entrada" : "entradas"})`,
      status: "ok",
    });
  }

  // ===== Sync periodicos =====
  const syncMinutes = minutesSince(clinic.lastClinicorpSyncAt, now);
  if (syncMinutes === null) {
    checks.push({
      id: "sync-clinicorp",
      label: "Sync automatico do Clinicorp",
      status: "warning",
      message: "Sync ainda nao rodou nesta clinica (aguarde ~15min apos o deploy ou clique 'Sincronizar' no header).",
    });
  } else if (syncMinutes > SYNC_STALE_MINUTES) {
    checks.push({
      id: "sync-clinicorp",
      label: "Sync automatico do Clinicorp",
      status: "error",
      message: `Ultimo sync ha ${syncMinutes}min — esperado a cada 15min. Worker pode estar travado.`,
    });
  } else {
    checks.push({
      id: "sync-clinicorp",
      label: "Sync automatico do Clinicorp",
      status: "ok",
      message: `Ultimo sync ha ${syncMinutes}min`,
    });
  }

  const matchMinutes = minutesSince(clinic.lastMatchLeadsAt, now);
  if (matchMinutes === null) {
    checks.push({
      id: "match-leads",
      label: "Match automatico de leads",
      status: "warning",
      message: "Match ainda nao rodou (aguarde ~15min apos o deploy).",
    });
  } else if (matchMinutes > SYNC_STALE_MINUTES) {
    checks.push({
      id: "match-leads",
      label: "Match automatico de leads",
      status: "error",
      message: `Ultimo match ha ${matchMinutes}min — esperado a cada 15min.`,
    });
  } else {
    checks.push({
      id: "match-leads",
      label: "Match automatico de leads",
      status: "ok",
      message: `Ultimo match ha ${matchMinutes}min`,
    });
  }

  // ===== Atividade =====
  checks.push({
    id: "kommo-activity",
    label: "Webhooks do Kommo (24h)",
    status: counts.kommoWebhooks24h > 0 ? "ok" : "warning",
    message:
      counts.kommoWebhooks24h > 0
        ? `${counts.kommoWebhooks24h} webhook(s) recebido(s)`
        : "Nenhum webhook do Kommo nas ultimas 24h. Verifique se a URL esta cadastrada no Kommo.",
  });

  checks.push({
    id: "clinicorp-activity",
    label: "Webhooks do Clinicorp (24h)",
    status: counts.clinicorpWebhooks24h > 0 ? "ok" : "warning",
    message:
      counts.clinicorpWebhooks24h > 0
        ? `${counts.clinicorpWebhooks24h} webhook(s) recebido(s)`
        : "Nenhum webhook do Clinicorp nas ultimas 24h. Verifique se a URL esta cadastrada no Clinicorp.",
  });

  if (counts.errorWebhooks24h > 0) {
    checks.push({
      id: "webhook-errors",
      label: "Erros recentes em webhooks",
      status: "error",
      message: `${counts.errorWebhooks24h} erro(s) nas ultimas 24h. Veja em /dashboard/logs.`,
    });
  } else {
    checks.push({
      id: "webhook-errors",
      label: "Erros recentes em webhooks",
      status: "ok",
      message: "Sem erros nas ultimas 24h.",
    });
  }

  // ===== Info-only =====
  checks.push({
    id: "info-leads",
    label: "Leads novos (24h)",
    status: "info",
    message: `${counts.leadsCreated24h} lead(s)`,
  });

  checks.push({
    id: "info-procedures",
    label: "Procedimentos novos (24h)",
    status: "info",
    message: `${counts.proceduresCreated24h} procedure(s)`,
  });

  return checks;
}

// ===== Kommo fields check (chamado em endpoint separado, com fetch a Kommo) =====

export interface KommoCustomFieldShape {
  id: number;
  name: string;
  type: string;
  code: string | null;
}

export interface KommoFieldsCheck {
  appointmentDate: HealthCheck;
  professional: HealthCheck;
}

/**
 * Recebe a lista de custom fields que o Kommo retornou e checa se ha fields
 * que matcham os criterios usados em runtime (extractAppointmentFields).
 *
 * Note: Kommo retorna campos de leads, contatos e companhias separadamente.
 * O caller deve chamar so /leads/custom_fields (que e o que o webhook le).
 */
export function checkKommoCustomFields(
  fields: KommoCustomFieldShape[] | null | undefined,
): KommoFieldsCheck {
  if (!fields || fields.length === 0) {
    return {
      appointmentDate: {
        id: "kommo-field-date",
        label: "Campo 'DATA E HORA CONSULTA' no Kommo",
        status: "error",
        message: "Nao foi possivel listar os custom fields do Kommo.",
      },
      professional: {
        id: "kommo-field-prof",
        label: "Campo 'ATENDIDO POR' no Kommo",
        status: "error",
        message: "Nao foi possivel listar os custom fields do Kommo.",
      },
    };
  }

  const hasAppointment = fields.some((f) =>
    hasAppointmentNameKeyword(f.name) ||
    (f.code === "appointment_date") ||
    (hasTimeNameKeyword(f.name) && hasAppointmentNameKeyword(f.name)),
  );
  const hasTime = fields.some((f) => hasTimeNameKeyword(f.name));
  const hasCombined = fields.some(
    (f) =>
      hasAppointmentNameKeyword(f.name) &&
      (f.type === "date_time" || hasTimeNameKeyword(f.name)),
  );
  const hasProfessional = fields.some((f) =>
    isProfessionalField(f.name, f.code ?? ""),
  );

  // Caso ideal: campo unico date_time (ex: "DATA E HORA CONSULTA").
  // Caso aceitavel: campo de data + campo de hora separados.
  let dateCheck: HealthCheck;
  if (hasCombined) {
    dateCheck = {
      id: "kommo-field-date",
      label: "Campo de data/hora da consulta",
      status: "ok",
      message: "Campo combinado (date_time) detectado.",
    };
  } else if (hasAppointment && hasTime) {
    dateCheck = {
      id: "kommo-field-date",
      label: "Campo de data/hora da consulta",
      status: "ok",
      message: "Campos separados de data + hora detectados.",
    };
  } else if (hasAppointment) {
    dateCheck = {
      id: "kommo-field-date",
      label: "Campo de data/hora da consulta",
      status: "warning",
      message: "Campo de data detectado, mas sem campo de hora correspondente.",
    };
  } else {
    dateCheck = {
      id: "kommo-field-date",
      label: "Campo de data/hora da consulta",
      status: "error",
      message: "Nenhum campo com nome 'data consulta', 'data agendamento' ou tipo date_time foi encontrado.",
    };
  }

  const profCheck: HealthCheck = hasProfessional
    ? {
        id: "kommo-field-prof",
        label: "Campo 'ATENDIDO POR' no Kommo",
        status: "ok",
      }
    : {
        id: "kommo-field-prof",
        label: "Campo 'ATENDIDO POR' no Kommo",
        status: "error",
        message: "Nenhum campo com nome 'profissional', 'dentista', 'atendido' ou code='professional_id' foi encontrado.",
      };

  return { appointmentDate: dateCheck, professional: profCheck };
}
