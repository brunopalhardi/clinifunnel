import { Queue, Worker } from "bullmq";
import { logger } from "@/lib/logger";

const log = logger.child({ scope: "match-leads" });

import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { matchLeadToPatient, linkLeadToPatient } from "@/lib/matching/lead-patient";

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

    // Job e global (sem clinicId): considera leads de todas as clinicas. Marca
    // lastMatchLeadsAt em todas pra refletir que o job rodou — usado pelo
    // indicador "Atualizado ha Xmin" no header.
    const now = new Date();
    await prisma.clinic.updateMany({ data: { lastMatchLeadsAt: now } });

    log.info(
      { processed: unmatchedLeads.length, matched },
      "leads processed",
    );
  },
  { connection: redis }
);

matchLeadsWorker.on("failed", (job, err) => {
  log.error({ jobId: job?.id, err: err.message }, "job failed");
});
