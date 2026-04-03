import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseKommoWebhook } from "@/lib/kommo/webhooks";
import { KommoClient } from "@/lib/kommo/client";
import { extractUTMsFromCustomFields } from "@/lib/kommo/utm";
import { classifyChannel } from "@/lib/utils/utm";
import { normalizePhoneBR } from "@/lib/utils/phone";
import { createPatientQueue } from "@/workers/create-patient";

function extractContact(kommoLead: {
  _embedded?: {
    contacts?: Array<{
      custom_fields_values: Array<{
        field_code: string | null;
        values: Array<{ value: string }>;
      }> | null;
    }>;
  };
}) {
  let phone: string | null = null;
  let email: string | null = null;

  const contacts = kommoLead._embedded?.contacts;
  if (contacts?.length) {
    const contact = contacts[0];
    if (contact.custom_fields_values) {
      for (const field of contact.custom_fields_values) {
        if (field.field_code === "PHONE" && field.values.length > 0) {
          phone = normalizePhoneBR(field.values[0].value);
        }
        if (field.field_code === "EMAIL" && field.values.length > 0) {
          email = field.values[0].value;
        }
      }
    }
  }

  return { phone, email };
}

async function processLead(
  clinic: {
    id: string;
    kommoSubdomain: string;
    kommoToken: string;
    stageAgendamento: string | null;
  },
  leadId: string,
  statusId: string,
  pipelineId: string
) {
  const kommoClient = new KommoClient(
    clinic.kommoSubdomain,
    clinic.kommoToken
  );
  const kommoLead = await kommoClient.getLead(parseInt(leadId));

  const utms = extractUTMsFromCustomFields(kommoLead.custom_fields_values);
  const channel = classifyChannel(utms);
  const { phone, email } = extractContact(kommoLead);

  const isAgendamento =
    clinic.stageAgendamento && statusId === clinic.stageAgendamento;

  const lead = await prisma.lead.upsert({
    where: {
      clinicId_kommoLeadId: {
        clinicId: clinic.id,
        kommoLeadId: String(kommoLead.id),
      },
    },
    update: {
      name: kommoLead.name,
      phone,
      email,
      ...utms,
      channel,
      kommoStatus: statusId,
      kommoPipelineId: pipelineId,
      ...(isAgendamento ? { agendamentoAt: new Date() } : {}),
    },
    create: {
      clinicId: clinic.id,
      kommoLeadId: String(kommoLead.id),
      name: kommoLead.name,
      phone,
      email,
      ...utms,
      channel,
      kommoStatus: statusId,
      kommoPipelineId: pipelineId,
      kommoCreatedAt: new Date(kommoLead.created_at * 1000),
      ...(isAgendamento ? { agendamentoAt: new Date() } : {}),
    },
  });

  // Enqueue patient creation when lead reaches "Agendado"
  if (isAgendamento && !lead.patientId) {
    await createPatientQueue.add(
      "create-patient",
      { leadId: lead.id },
      { jobId: `patient-${lead.id}`, attempts: 3, backoff: { type: "exponential", delay: 5000 } }
    );
  }

  return lead;
}

export async function POST(request: NextRequest) {
  let logId: string | undefined;

  try {
    const body = await request.text();

    const log = await prisma.webhookLog.create({
      data: {
        source: "kommo",
        event: "incoming",
        payload: body as unknown as object,
        status: "received",
      },
    });
    logId = log.id;

    const webhook = parseKommoWebhook(body);

    const subdomain = webhook.account?.subdomain;
    if (!subdomain) {
      await prisma.webhookLog.update({
        where: { id: logId },
        data: { status: "error", error: "No subdomain in webhook" },
      });
      return NextResponse.json({ ok: true });
    }

    const clinic = await prisma.clinic.findUnique({
      where: { kommoSubdomain: subdomain },
    });

    if (!clinic) {
      await prisma.webhookLog.update({
        where: { id: logId },
        data: { status: "error", error: `Clinic not found: ${subdomain}` },
      });
      return NextResponse.json({ ok: true });
    }

    let processed = 0;

    // Process new leads (add)
    if (webhook.leads?.add?.length) {
      for (const added of webhook.leads.add) {
        await processLead(clinic, added.id, added.status_id, added.pipeline_id);
        processed++;
      }
    }

    // Process status changes
    if (webhook.leads?.status?.length) {
      for (const statusChange of webhook.leads.status) {
        await processLead(
          clinic,
          statusChange.id,
          statusChange.status_id,
          statusChange.pipeline_id
        );
        processed++;
      }
    }

    const event =
      processed > 0
        ? `processed_${processed}_leads`
        : "ignored_no_lead_events";

    await prisma.webhookLog.update({
      where: { id: logId },
      data: { status: "processed", event },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Kommo webhook error:", error);

    if (logId) {
      await prisma.webhookLog.update({
        where: { id: logId },
        data: {
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }

    return NextResponse.json({ ok: true });
  }
}
