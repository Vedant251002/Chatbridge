import { Redis } from "ioredis";

declare global {
  var __redis: Redis | undefined;
}

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

export const redis: Redis =
  globalThis.__redis ??
  new Redis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false });

if (process.env.NODE_ENV !== "production") {
  globalThis.__redis = redis;
}
