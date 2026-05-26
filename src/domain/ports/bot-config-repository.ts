import type { BotConfig } from "../entities/bot-config.js";

export interface BotConfigRepository {
  getActive(userId: string): Promise<BotConfig | null>;
  upsert(userId: string, prompt: string): Promise<BotConfig>;
}
