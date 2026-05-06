// SEC-3: retencao de WebhookLog. Roda semanal, deleta logs com mais de
// WEBHOOK_LOG_RETENTION_DAYS (default 90).
//
// Por que worker (em vez de pg_cron / cron do SO):
// - Stack ja tem BullMQ + Redis pra repeat — sem nova dependencia
// - Aproveita logs estruturados, error reporting e graceful shutdown
//   ja existentes em src/workers/index.ts
//
// Por que nao "pg_cron":
// - PG e nativo do host (FASE 1) e nao temos extension instalada
// - Mover esta regra pra BD acopla retencao a banco; aqui fica em codigo

import { Queue, Worker } from "bullmq";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const log = logger.child({ scope: "webhook-log-cleanup" });

const QUEUE_NAME = "webhook-log-cleanup";

const RETENTION_DAYS = parseInt(
  process.env.WEBHOOK_LOG_RETENTION_DAYS ?? "90",
  10,
);

// Limite por execucao pra evitar query muito longa em DB grande.
// Se tiver mais que isso, proxima execucao da conta.
const BATCH_LIMIT = 5000;

export const webhookLogCleanupQueue = new Queue(QUEUE_NAME, {
  connection: redis,
});

// Repeat: 1x por semana. Domingo 03:00 UTC = madrugada na maioria dos
// timezones de cliente (Brasil = sabado 23h ou 00h).
webhookLogCleanupQueue.add(
  "cleanup",
  {},
  {
    repeat: { pattern: "0 3 * * 0" },
    removeOnComplete: 20,
    removeOnFail: 20,
  },
);

export const webhookLogCleanupWorker = new Worker(
  QUEUE_NAME,
  async () => {
    if (RETENTION_DAYS <= 0) {
      log.warn({ RETENTION_DAYS }, "retention disabled (<= 0)");
      return;
    }
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    log.info({ cutoff: cutoff.toISOString(), RETENTION_DAYS }, "starting cleanup");

    // deleteMany sem batching gera 1 query DELETE com WHERE — Postgres aguenta
    // bem. Mas pra DBs muito grandes, BATCH_LIMIT evita transacao longa.
    // Implementacao: select ids primeiro, depois delete por ids.
    const candidates = await prisma.webhookLog.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true },
      take: BATCH_LIMIT,
    });

    if (candidates.length === 0) {
      log.info("no logs to delete");
      return;
    }

    const result = await prisma.webhookLog.deleteMany({
      where: { id: { in: candidates.map((c) => c.id) } },
    });

    log.info(
      { deleted: result.count, hadMore: candidates.length === BATCH_LIMIT },
      "cleanup done",
    );
  },
  { connection: redis, concurrency: 1 },
);

webhookLogCleanupWorker.on("completed", (job) => {
  log.info({ jobId: job.id }, "job completed");
});

webhookLogCleanupWorker.on("failed", (job, err) => {
  log.error({ jobId: job?.id, err: err.message }, "job failed");
});
