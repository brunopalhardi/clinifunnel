import { Queue, Worker } from "bullmq";
import { logger } from "@/lib/logger";

const log = logger.child({ scope: "match-leads" });

import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { matchLeadToPatient, linkLeadToPatient } from "@/lib/matching/lead-patient";

export const matchLeadsQueue = new Queue("match-leads", {
  connection: redis,
});

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
