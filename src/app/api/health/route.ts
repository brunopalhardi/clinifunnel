import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/version";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEP_TIMEOUT_MS = 800;

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

export async function GET() {
  const [db, redisStatus] = await Promise.all([pingDb(), pingRedis()]);
  const allOk = db === "ok" && redisStatus === "ok";

  return NextResponse.json({
    status: allOk ? "ok" : "degraded",
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
    db,
    redis: redisStatus,
  });
}
