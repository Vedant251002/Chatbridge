import type { Message, MessageSender } from "../entities/message.js";

export interface CreateMessageInput {
  conversationId: string;
  sender: MessageSender;
  message: string;
  aiOutput?: Record<string, unknown>;
}

export interface MessageRepository {
  create(input: CreateMessageInput): Promise<Message>;
  findByConversationId(conversationId: string): Promise<Message[]>;
}
