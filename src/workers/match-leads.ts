import { Queue, Worker } from "bullmq";
import { logger } from "@/lib/logger";

const log = logger.child({ scope: "match-leads" });

import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { matchLeadToPatient, linkLeadToPatient } from "@/lib/matching/lead-patient";
import { KommoClient } from "@/lib/kommo/client";

export const matchLeadsQueue = new Queue("match-leads", {
  connection: redis,
});

// Match periodico a cada 15 minutos. Casa novos leads do Kommo a pacientes
// existentes do Clinicorp sem precisar do botao manual no dashboard.
matchLeadsQueue.add(
  "match",
  {},
  {
    repeat: { every: 15 * 60 * 1000 },
    removeOnComplete: 50,
    removeOnFail: 50,
  },
);

export const matchLeadsWorker = new Worker(
  "match-leads",
  async () => {
    // Find all leads without a linked patient
    const unmatchedLeads = await prisma.lead.findMany({
      where: { patientId: null },
      take: 200,
    });

    let matched = 0;

    for (const lead of unmatchedLeads) {
      const patient = await matchLeadToPatient(lead);
      if (patient) {
        await linkLeadToPatient(lead.id, patient.id);
        matched++;
      }
    }

    // [LEAD-2] Atualiza cache de stages do Kommo (Clinic.kommoStages) pra cada
    // clinica que tem credenciais Kommo. Permite traduzir Lead.kommoStatus (ID)
    // em nome humano na UI sem chamada extra no request. Stages raramente mudam,
    // entao chamar a cada 15min eh seguro (1 request por clinica).
    let stagesUpdated = 0;
    const clinicsWithKommo = await prisma.clinic.findMany({
      where: { kommoSubdomain: { not: "" }, kommoToken: { not: "" } },
      select: { id: true, kommoSubdomain: true, kommoToken: true },
    });
    for (const c of clinicsWithKommo) {
      try {
        const client = new KommoClient(c.kommoSubdomain, c.kommoToken);
        const pipelines = await client.getPipelines();
        // Flatten todos os stages num map { id: { name, color, pipelineId } }
        const stagesMap: Record<string, { name: string; color: string; pipelineId: string }> = {};
        for (const p of pipelines) {
          const statuses = p._embedded?.statuses ?? p.statuses ?? [];
          for (const s of statuses) {
            stagesMap[String(s.id)] = {
              name: s.name,
              color: s.color ?? "",
              pipelineId: String(p.id),
            };
          }
        }
        await prisma.clinic.update({
          where: { id: c.id },
          data: { kommoStages: stagesMap },
        });
        stagesUpdated++;
      } catch (err) {
        log.error({ clinicId: c.id, err }, "failed to update kommo stages");
      }
    }

    // Job e global (sem clinicId): considera leads de todas as clinicas. Marca
    // lastMatchLeadsAt em todas pra refletir que o job rodou — usado pelo
    // indicador "Atualizado ha Xmin" no header.
    const now = new Date();
    await prisma.clinic.updateMany({ data: { lastMatchLeadsAt: now } });

    log.info(
      { processed: unmatchedLeads.length, matched, stagesUpdated },
      "leads processed",
    );
  },
  { connection: redis }
);

matchLeadsWorker.on("failed", (job, err) => {
  log.error({ jobId: job?.id, err: err.message }, "job failed");
});
