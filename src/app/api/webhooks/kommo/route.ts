import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { parseKommoWebhook } from "@/lib/kommo/webhooks";
import { getProcessKommoLeadQueue } from "@/lib/queues";

const log = logger.child({ scope: "webhook-kommo" });

export async function POST(request: NextRequest) {
  let logId: string | undefined;

  try {
    const body = await request.text();

    const webhookLog = await prisma.webhookLog.create({
      data: {
        source: "kommo",
        event: "incoming",
        payload: body as unknown as object,
        status: "received",
      },
    });
    logId = webhookLog.id;

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
      select: { id: true },
    });

    if (!clinic) {
      await prisma.webhookLog.update({
        where: { id: logId },
        data: { status: "error", error: `Clinic not found: ${subdomain}` },
      });
      return NextResponse.json({ ok: true });
    }

    // [SEC-2.1] Vincula log a clinica identificada — clinic_admin podera ver
    // logs da propria clinica via /api/webhook-logs.
    await prisma.webhookLog.update({
      where: { id: logId },
      data: { clinicId: clinic.id },
    });

    // [CAP-12] Processamento ASSINCRONO. Antes, o handler chamava o Kommo
    // (getLead + getContact) de forma sincrona aqui. Sob rajada isso tomava
    // 429 (Too Many Requests), o erro era engolido, o handler respondia 200 e
    // o Kommo NUNCA reenviava => mudanca de stage perdida (inclusive
    // "Agendado", zerando "Consultas agendadas"). Agora so enfileiramos e
    // respondemos 200 rapido; o worker process-kommo-lead faz as chamadas com
    // retry/backoff, entao o 429 e absorvido sem perda de evento.
    const queue = getProcessKommoLeadQueue();
    const jobs: Array<{ leadId: string; statusId: string; pipelineId: string }> = [];

    if (webhook.leads?.add?.length) {
      for (const added of webhook.leads.add) {
        jobs.push({ leadId: added.id, statusId: added.status_id, pipelineId: added.pipeline_id });
      }
    }
    if (webhook.leads?.status?.length) {
      for (const statusChange of webhook.leads.status) {
        jobs.push({
          leadId: statusChange.id,
          statusId: statusChange.status_id,
          pipelineId: statusChange.pipeline_id,
        });
      }
    }

    await Promise.all(
      jobs.map((j) =>
        queue.add(
          "process-kommo-lead",
          { clinicId: clinic.id, ...j },
          {
            attempts: 8,
            backoff: { type: "exponential", delay: 15000 },
            removeOnComplete: 1000,
            removeOnFail: 5000,
          }
        )
      )
    );

    await prisma.webhookLog.update({
      where: { id: logId },
      data: {
        status: "processed",
        event: jobs.length > 0 ? `enqueued_${jobs.length}_leads` : "ignored_no_lead_events",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    log.error({ err: error }, "webhook handler error");

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
