import type { PrismaClient } from "@prisma/client";
import { DatabaseError } from "../../utils/errors.js";
import type { BotConfigRepository } from "../../domain/ports/bot-config-repository.js";
import type { BotConfig } from "../../domain/entities/bot-config.js";

const SINGLETON_ID = "default";

export class PrismaBotConfigRepository implements BotConfigRepository {
  constructor(private readonly db: PrismaClient) {}

  async getActive(): Promise<BotConfig | null> {
    try {
      return await this.db.botConfig.findUnique({ where: { id: SINGLETON_ID } });
    } catch (error) {
      throw new DatabaseError("Failed to load bot config", error);
    }
  }

  async upsert(prompt: string): Promise<BotConfig> {
    try {
      return await this.db.botConfig.upsert({
        where: { id: SINGLETON_ID },
        update: { prompt },
        create: { id: SINGLETON_ID, prompt },
      });
    } catch (error) {
      throw new DatabaseError("Failed to upsert bot config", error);
    }
  }
}
