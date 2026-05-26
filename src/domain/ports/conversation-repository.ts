import type { Conversation, ConversationPage } from "../entities/conversation.js";

export interface ConversationRepository {
  findById(id: string): Promise<Conversation | null>;
  findOrCreate(
    userId: string,
    phone: string,
    threadId: string
  ): Promise<{ conversation: Conversation; isNew: boolean }>;
  list(userId: string, limit: number, offset: number): Promise<ConversationPage>;
  setAiPaused(id: string, paused: boolean, agent: string | null): Promise<Conversation>;
  touchActivity(id: string): Promise<void>;
}
