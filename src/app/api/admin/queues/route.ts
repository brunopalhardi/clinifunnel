import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAllQueues } from "@/lib/queues";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const log = logger.child({ scope: "api-admin-queues" });

interface QueueMetrics {
  name: string;
  counts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  };
  // Tempo medio de processamento dos ultimos N completed (ms).
  avgProcessingMs: number | null;
  sampleSize: number;
  lastCompletedAt: string | null;
  lastFailedAt: string | null;
}

const SAMPLE_LIMIT = 20;

async function collectQueueMetrics(
  name: string,
  queue: import("bullmq").Queue,
): Promise<QueueMetrics> {
  // BullMQ getJobCounts aceita lista de status. Sem args retorna todos.
  const counts = await queue.getJobCounts(
    "waiting",
    "active",
    "completed",
    "failed",
    "delayed",
    "paused",
  );

  const completed = await queue.getCompleted(0, SAMPLE_LIMIT - 1);
  const failed = await queue.getFailed(0, 0);

  const durations = completed
    .filter((j) => j.processedOn && j.finishedOn)
    .map((j) => (j.finishedOn as number) - (j.processedOn as number));

  const avgProcessingMs = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null;

  return {
    name,
    counts: {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
      delayed: counts.delayed ?? 0,
      paused: counts.paused ?? 0,
    },
    avgProcessingMs,
    sampleSize: durations.length,
    lastCompletedAt: completed[0]?.finishedOn
      ? new Date(completed[0].finishedOn).toISOString()
      : null,
    lastFailedAt: failed[0]?.finishedOn
      ? new Date(failed[0].finishedOn).toISOString()
      : null,
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }
  // Apenas super_admin: filas sao globais (nao multi-tenant) e expor pra
  // clinic_admin pode vazar volume de jobs de outras clinicas.
  if (session.user.role !== "super_admin") {
    return NextResponse.json({ error: "Sem permissao" }, { status: 403 });
  }

  try {
    const queues = getAllQueues();
    const data = await Promise.all(
      queues.map(({ name, queue }) => collectQueueMetrics(name, queue)),
    );
    return NextResponse.json({ data, generatedAt: new Date().toISOString() });
  } catch (err) {
    log.error({ err }, "failed to collect queue metrics");
    return NextResponse.json(
      { error: "Falha ao coletar metricas" },
      { status: 500 },
    );
  }
}
