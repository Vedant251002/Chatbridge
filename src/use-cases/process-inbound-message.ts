import type { Logger } from "../domain/ports/logger.js";
import type { ConversationRepository } from "../domain/ports/conversation-repository.js";
import type { MessageRepository } from "../domain/ports/message-repository.js";
import type { AiProvider } from "../domain/ports/ai-provider.js";
import type { BotConfigRepository } from "../domain/ports/bot-config-repository.js";
import type { AllowedNumberRepository } from "../domain/ports/allowed-number-repository.js";
import type { WhatsAppSender } from "../domain/ports/whatsapp-sender.js";
import type { RealtimePublisher } from "../domain/ports/realtime-publisher.js";
import type { InboundMessage } from "../domain/entities/inbound-message.js";
import type { AssessmentOutput } from "../domain/entities/assessment.js";
import { AiServiceError, DatabaseError } from "../utils/errors.js";
import { buildThreadId, sanitizePhone } from "../utils/helpers.js";
import {
  buildConversationMessages,
  composeSystemPromptWithContext,
} from "../ai/prompts.js";
import type { RetrieveKnowledge } from "./retrieve-knowledge.js";

const FALLBACK_REPLY =
  "Sorry, I'm having trouble processing your request right now. Please try again later.";

const FALLBACK_OUTPUT: AssessmentOutput = {
  classification: "unknown",
  summary: "AI processing temporarily unavailable",
  suggestedReply: FALLBACK_REPLY,
  confidence: 0,
};

export interface ProcessInboundMessageDeps {
  conversationRepo: ConversationRepository;
  messageRepo: MessageRepository;
  aiProvider: AiProvider;
  botConfigRepo: BotConfigRepository;
  allowedNumberRepo: AllowedNumberRepository;
  whatsAppSender: WhatsAppSender;
  realtime: RealtimePublisher;
  retrieveKnowledge: RetrieveKnowledge;
  logger: Logger;
}

export class ProcessInboundMessage {
  constructor(private readonly deps: ProcessInboundMessageDeps) {}

  async execute(input: InboundMessage): Promise<void> {
    const {
      conversationRepo,
      messageRepo,
      aiProvider,
      botConfigRepo,
      allowedNumberRepo,
      whatsAppSender,
      realtime,
      retrieveKnowledge,
      logger,
    } = this.deps;

    const phone = sanitizePhone(input.phone);
    const threadId = buildThreadId(phone);

    try {
      const { conversation } = await conversationRepo.findOrCreate(phone, threadId);

      const history = await messageRepo.findByConversationId(conversation.id);

      // Persist inbound — agents need to see it whether AI replies or not.
      const userMsg = await messageRepo.create({
        conversationId: conversation.id,
        sender: "user",
        message: input.text,
      });
      await conversationRepo.touchActivity(conversation.id);
      await realtime.publish({
        type: "message.created",
        conversationId: conversation.id,
        messageId: userMsg.id,
      });

      // ─── HITL: skip AI when the conversation is in agent-takeover mode ─
      if (conversation.aiPaused) {
        logger.info("AI paused for conversation, skipping auto-reply", {
          conversationId: conversation.id,
        });
        return;
      }

      // ─── Allowlist gate: AI replies only to listed phones. ─────────────
      // Empty allowlist = AI is silent for everyone.
      const allowed = await allowedNumberRepo.isAllowed(phone);
      if (!allowed) {
        logger.info("Phone not in allowlist, skipping AI reply", {
          conversationId: conversation.id,
          phone,
          jid: input.jid,
        });
        return;
      }

      // ─── RAG: ground the system prompt in retrieved chunks ──────────────
      const retrieved = await retrieveKnowledge.execute(input.text);
      const config = await botConfigRepo.getActive();
      const systemPrompt = composeSystemPromptWithContext(
        config?.prompt ?? null,
        retrieved
      );
      const aiMessages = buildConversationMessages(systemPrompt, history, input.text);

      let output: AssessmentOutput = FALLBACK_OUTPUT;
      let reply = FALLBACK_REPLY;
      let tokensUsed = 0;

      try {
        const result = await aiProvider.fetchAssessment(aiMessages);
        output = result.structured;
        reply = result.reply;
        tokensUsed = result.tokensUsed;
        logger.info("AI assessment complete", {
          conversationId: conversation.id,
          tokensUsed,
          classification: output.classification,
          retrievedChunks: retrieved.length,
        });
      } catch (error) {
        if (error instanceof AiServiceError) {
          logger.error("AI assessment failed, using fallback", { error: String(error) });
        } else {
          throw error;
        }
      }

      // Annotate aiOutput with retrieval metadata so the admin UI can show
      // "answered using doc X chunk N".
      const aiOutputAnnotated = {
        ...output,
        tokensUsed,
        retrievedChunkIds: retrieved.map((r) => r.id),
        sources: retrieved.map((r) => ({
          documentId: r.documentId,
          documentTitle: r.documentTitle,
          ordinal: r.ordinal,
          similarity: r.similarity,
        })),
      };

      const assistantMsg = await messageRepo.create({
        conversationId: conversation.id,
        sender: "assistant",
        message: reply,
        aiOutput: aiOutputAnnotated as unknown as Record<string, unknown>,
      });
      await conversationRepo.touchActivity(conversation.id);
      await realtime.publish({
        type: "message.created",
        conversationId: conversation.id,
        messageId: assistantMsg.id,
      });

      await whatsAppSender.sendMessage(input.jid, reply);
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      logger.error("Unhandled error in inbound processing", { error: String(error) });
    }
  }
}
