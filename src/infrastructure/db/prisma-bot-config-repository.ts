import type { PrismaClient } from "@prisma/client";
import { DatabaseError } from "../../utils/errors.js";
import type { BotConfigRepository } from "../../domain/ports/bot-config-repository.js";
import type { BotConfig } from "../../domain/entities/bot-config.js";

export class PrismaBotConfigRepository implements BotConfigRepository {
  constructor(private readonly db: PrismaClient) {}

  async getActive(userId: string): Promise<BotConfig | null> {
    try {
      const row = await this.db.botConfig.findUnique({ where: { userId } });
      return row as BotConfig | null;
    } catch (error) {
      throw new DatabaseError("Failed to load bot config", error);
    }
  }

  async upsert(userId: string, prompt: string): Promise<BotConfig> {
    try {
      const row = await this.db.botConfig.upsert({
        where: { userId },
        update: { prompt },
        create: { userId, prompt },
      });
      return row as BotConfig;
    } catch (error) {
      throw new DatabaseError("Failed to upsert bot config", error);
    }
  }
}
