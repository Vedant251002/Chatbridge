import type { BotConfig } from "../entities/bot-config.js";

export interface BotConfigRepository {
  getActive(): Promise<BotConfig | null>;
  upsert(prompt: string): Promise<BotConfig>;
}
