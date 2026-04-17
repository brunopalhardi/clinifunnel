import "dotenv/config";
import IORedis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: IORedis | undefined;
};

function createRedis(): IORedis {
  return new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });
}

export const redis = globalForRedis.redis ?? createRedis();

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;
