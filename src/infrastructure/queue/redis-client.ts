import { Redis } from "ioredis";
import type { Logger } from "../../domain/ports/logger.js";

export function createRedisClient(redisUrl: string, logger: Logger): Redis {
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  redis.on("error", (error: Error) => {
    logger.error("Redis connection error", { error: String(error) });
  });
  redis.on("connect", () => logger.info("Redis connected"));

  return redis;
}
