import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/version";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { getAllQueues } from "@/lib/queues";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEP_TIMEOUT_MS = 800;
const QUEUES_TIMEOUT_MS = 800;

type DepStatus = "ok" | "down";

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms),
    ),
  ]);
}

async function pingDb(): Promise<DepStatus> {
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, DEP_TIMEOUT_MS);
    return "ok";
  } catch {
    return "down";
  }
}

async function pingRedis(): Promise<DepStatus> {
  try {
    const reply = await withTimeout(redis.ping(), DEP_TIMEOUT_MS);
    return reply === "PONG" ? "ok" : "down";
  } catch {
    return "down";
  }
}

interface QueueHealth {
  name: string;
  waiting: number;
  failed: number;
  lastCompletedAt: string | null;
  lastFailedAt: string | null;
}

// Sumario slim de cada fila pra detectar workers travados (ex: lastCompletedAt
// ha horas mas waiting > 0). Mais detalhe em /api/admin/queues.
async function getQueueHealth(): Promise<QueueHealth[] | null> {
  try {
    return await withTimeout(
      Promise.all(
        getAllQueues().map(async ({ name, queue }) => {
          const [counts, completed, failed] = await Promise.all([
            queue.getJobCounts("waiting", "failed"),
            queue.getCompleted(0, 0),
            queue.getFailed(0, 0),
          ]);
          return {
            name,
            waiting: counts.waiting ?? 0,
            failed: counts.failed ?? 0,
            lastCompletedAt: completed[0]?.finishedOn
              ? new Date(completed[0].finishedOn).toISOString()
              : null,
            lastFailedAt: failed[0]?.finishedOn
              ? new Date(failed[0].finishedOn).toISOString()
              : null,
          };
        }),
      ),
      QUEUES_TIMEOUT_MS,
    );
  } catch {
    // Falha silenciosa: response retorna sem campo `queues`. Endpoint
    // continua util pra healthcheck do swarm; observabilidade externa
    // monitora o "ausente" como sinal.
    return null;
  }
}

export async function GET() {
  const [db, redisStatus, queues] = await Promise.all([
    pingDb(),
    pingRedis(),
    getQueueHealth(),
  ]);

  // Status agregado continua baseado SO em db+redis. Filas sao informativas:
  // worker travado nao deve fazer Traefik tirar a replica do pool.
  const allOk = db === "ok" && redisStatus === "ok";

  return NextResponse.json({
    status: allOk ? "ok" : "degraded",
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
    db,
    redis: redisStatus,
    queues,
  });
}
