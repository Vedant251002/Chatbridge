import type { PrismaClient } from "@prisma/client";
import { DatabaseError } from "../../utils/errors.js";
import type { ConversationRepository } from "../../domain/ports/conversation-repository.js";
import type { Conversation, ConversationPage } from "../../domain/entities/conversation.js";

export class PrismaConversationRepository implements ConversationRepository {
  constructor(private readonly db: PrismaClient) {}

  async findById(id: string): Promise<Conversation | null> {
    try {
      return (await this.db.conversation.findUnique({ where: { id } })) as Conversation | null;
    } catch (error) {
      throw new DatabaseError("Failed to find conversation by id", error);
    }
  }

  async list(userId: string, limit: number, offset: number): Promise<ConversationPage> {
    try {
      const [conversations, total] = await this.db.$transaction([
        this.db.conversation.findMany({
          where: { userId },
          orderBy: { lastActivityAt: "desc" },
          take: limit,
          skip: offset,
        }),
        this.db.conversation.count({ where: { userId } }),
      ]);
      return { conversations: conversations as Conversation[], total };
    } catch (error) {
      throw new DatabaseError("Failed to list conversations", error);
    }
  }

  async findOrCreate(
    userId: string,
    phone: string,
    threadId: string
  ): Promise<{ conversation: Conversation; isNew: boolean }> {
    try {
      // Composite unique on (user_id, phone) means each user keeps a
      // separate thread for the same external phone number.
      const existing = await this.db.conversation.findUnique({
        where: { userId_phone: { userId, phone } },
      });
      if (existing) return { conversation: existing as Conversation, isNew: false };

      const created = await this.db.conversation.create({
        data: { userId, phone, threadId },
      });
      return { conversation: created as Conversation, isNew: true };
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      throw new DatabaseError("Failed to find or create conversation", error);
    }
  }

  async setAiPaused(
    id: string,
    paused: boolean,
    agent: string | null
  ): Promise<Conversation> {
    try {
      const updated = await this.db.conversation.update({
        where: { id },
        data: {
          aiPaused: paused,
          takenOverBy: paused ? agent : null,
          lastActivityAt: new Date(),
        },
      });
      return updated as Conversation;
    } catch (error) {
      throw new DatabaseError("Failed to update conversation pause state", error);
    }
  }

  async touchActivity(id: string): Promise<void> {
    try {
      await this.db.conversation.update({
        where: { id },
        data: { lastActivityAt: new Date() },
      });
    } catch (error) {
      throw new DatabaseError("Failed to touch conversation activity", error);
    }
  }
}
