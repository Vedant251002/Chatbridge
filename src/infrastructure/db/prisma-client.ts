import { PrismaClient } from "@prisma/client";
import type { AppConfig } from "../../config.js";

declare global {
  var __prismaClient: PrismaClient | undefined;
}

export function createPrismaClient(
  config: Pick<AppConfig, "logLevel" | "nodeEnv">
): PrismaClient {
  const logLevels: ("query" | "info" | "warn" | "error")[] =
    config.nodeEnv === "development" ? ["warn", "error"] : ["error"];

  return new PrismaClient({ log: logLevels });
}

export function getPrismaClient(
  config: Pick<AppConfig, "logLevel" | "nodeEnv">
): PrismaClient {
  if (config.nodeEnv === "development") {
    globalThis.__prismaClient ??= createPrismaClient(config);
    return globalThis.__prismaClient;
  }

  return createPrismaClient(config);
}
