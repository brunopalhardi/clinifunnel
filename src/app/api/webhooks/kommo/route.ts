import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseKommoWebhook } from "@/lib/kommo/webhooks";
import { KommoClient } from "@/lib/kommo/client";
import { extractUTMsFromCustomFields } from "@/lib/kommo/utm";
import { classifyChannel } from "@/lib/utils/utm";
import { normalizePhoneBR } from "@/lib/utils/phone";

export async function POST(request: NextRequest) {
  let logId: string | undefined;

  try {
    const body = await request.text();

    // Log the webhook immediately
    const log = await prisma.webhookLog.create({
      data: {
        source: "kommo",
        event: "incoming",
        payload: body as unknown as object,
        status: "received",
      },
    });
    logId = log.id;

    // Parse the x-www-form-urlencoded payload
    const webhook = parseKommoWebhook(body);

    // Only process lead status changes
    if (!webhook.leads?.status?.length) {
      await prisma.webhookLog.update({
        where: { id: logId },
        data: { status: "processed", event: "ignored_no_status_change" },
      });
      return NextResponse.json({ ok: true });
    }

    const subdomain = webhook.account?.subdomain;
    if (!subdomain) {
      await prisma.webhookLog.update({
        where: { id: logId },
        data: { status: "error", error: "No subdomain in webhook" },
      });
      return NextResponse.json({ ok: true });
    }

    // Find the clinic
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

    for (const statusChange of webhook.leads.status) {
      const isAgendamento =
        clinic.stageAgendamento &&
        statusChange.status_id === clinic.stageAgendamento;

      if (!isAgendamento) continue;

      // Fetch full lead data from Kommo API
      const kommoClient = new KommoClient(
        clinic.kommoSubdomain,
        clinic.kommoToken
      );
      const kommoLead = await kommoClient.getLead(parseInt(statusChange.id));

      // Extract UTMs from custom fields
      const utms = extractUTMsFromCustomFields(
        kommoLead.custom_fields_values
      );
      const channel = classifyChannel(utms);

      // Extract contact info
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

      // Upsert lead
      await prisma.lead.upsert({
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
          kommoStatus: String(kommoLead.status_id),
          kommoPipelineId: String(kommoLead.pipeline_id),
          agendamentoAt: new Date(),
        },
        create: {
          clinicId: clinic.id,
          kommoLeadId: String(kommoLead.id),
          name: kommoLead.name,
          phone,
          email,
          ...utms,
          channel,
          kommoStatus: String(kommoLead.status_id),
          kommoPipelineId: String(kommoLead.pipeline_id),
          kommoCreatedAt: new Date(kommoLead.created_at * 1000),
          agendamentoAt: new Date(),
        },
      });

      // TODO: Enqueue BullMQ job "create-patient" when workers are set up
    }

    await prisma.webhookLog.update({
      where: { id: logId },
      data: { status: "processed", event: "lead_status_changed" },
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

    // Always return 200 to Kommo so it doesn't retry
    return NextResponse.json({ ok: true });
  }
}
