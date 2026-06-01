import { Queue, Worker } from "bullmq";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { processKommoLead } from "@/lib/kommo/process-lead";

const log = logger.child({ scope: "process-kommo-lead" });

export const processKommoLeadQueue = new Queue("process-kommo-lead", {
  connection: redis,
});

interface ProcessKommoLeadJob {
  clinicId: string;
  leadId: string;
  statusId: string;
  pipelineId: string;
}

export const processKommoLeadWorker = new Worker<ProcessKommoLeadJob>(
  "process-kommo-lead",
  async (job) => {
    const { clinicId, leadId, statusId, pipelineId } = job.data;

    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: {
        id: true,
        kommoSubdomain: true,
        kommoToken: true,
        stageAgendamento: true,
      },
    });

    if (!clinic) throw new Error(`Clinic not found: ${clinicId}`);
    if (!clinic.kommoSubdomain || !clinic.kommoToken) {
      log.warn({ clinicId }, "clinic without kommo config, skipping");
      return;
    }

    await processKommoLead(
      {
        id: clinic.id,
        kommoSubdomain: clinic.kommoSubdomain,
        kommoToken: clinic.kommoToken,
        stageAgendamento: clinic.stageAgendamento,
      },
      { leadId, statusId, pipelineId }
    );
  },
  // concurrency baixa de proposito: o gargalo e o rate-limit da API do Kommo
  // (~7 req/s, e cada job faz 2 chamadas). Sob 429 o job falha e o BullMQ
  // reenfileira com backoff exponencial (attempts setados no enqueue), entao
  // o evento nao se perde como antes.
  { connection: redis, concurrency: 3 }
);

processKommoLeadWorker.on("completed", (job) => {
  log.info({ jobId: job.id, leadId: job.data.leadId }, "kommo lead processed");
});

processKommoLeadWorker.on("failed", (job, err) => {
  log.error(
    { jobId: job?.id, leadId: job?.data?.leadId, attempts: job?.attemptsMade, err: err.message },
    "kommo lead processing failed"
  );
});
