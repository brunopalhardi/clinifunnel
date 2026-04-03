import { Queue, Worker } from "bullmq";
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

    console.log(
      `[match-leads] Processed ${unmatchedLeads.length} leads, matched ${matched}`
    );
  },
  { connection: redis }
);

matchLeadsWorker.on("failed", (job, err) => {
  console.error(`[match-leads] Job ${job?.id} failed:`, err.message);
});
