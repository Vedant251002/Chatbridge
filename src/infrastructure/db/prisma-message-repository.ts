import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { DatabaseError } from "../../utils/errors.js";
import type {
  CreateMessageInput,
  MessageRepository,
} from "../../domain/ports/message-repository.js";
import type { Message } from "../../domain/entities/message.js";

export class PrismaMessageRepository implements MessageRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: CreateMessageInput): Promise<Message> {
    try {
      const created = await this.db.message.create({
        data: {
          conversationId: input.conversationId,
          sender: input.sender,
          message: input.message,
          aiOutput: (input.aiOutput as Prisma.InputJsonValue) ?? Prisma.DbNull,
        },
      });
      return created as Message;
    } catch (error) {
      throw new DatabaseError("Failed to create message", error);
    }
  }

  async findByConversationId(conversationId: string): Promise<Message[]> {
    try {
      const rows = await this.db.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
      });
      return rows as Message[];
    } catch (error) {
      throw new DatabaseError("Failed to find messages by conversation", error);
    }
  }
}
