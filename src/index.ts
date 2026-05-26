import type { Worker } from "bullmq";
import type { Redis } from "ioredis";
import type { PrismaClient } from "@prisma/client";

import { CONFIG } from "./config.js";
import type { Logger } from "./domain/ports/logger.js";
import type { WhatsAppGateway } from "./domain/ports/whatsapp-gateway.js";

import { createPinoLogger } from "./infrastructure/logging/pino-logger.js";
import { getPrismaClient } from "./infrastructure/db/prisma-client.js";
import { PrismaConversationRepository } from "./infrastructure/db/prisma-conversation-repository.js";
import { PrismaMessageRepository } from "./infrastructure/db/prisma-message-repository.js";
import { PrismaBotConfigRepository } from "./infrastructure/db/prisma-bot-config-repository.js";
import { PrismaAllowedNumberRepository } from "./infrastructure/db/prisma-allowed-number-repository.js";
import { PrismaKnowledgeRepository } from "./infrastructure/db/prisma-knowledge-repository.js";
import { createRedisClient } from "./infrastructure/queue/redis-client.js";
import { createInboundMessageWorker } from "./infrastructure/queue/bullmq-message-worker.js";
import { BullMqMessagePublisher } from "./infrastructure/queue/bullmq-message-publisher.js";
import { createKnowledgeIngestWorker } from "./infrastructure/queue/bullmq-knowledge-worker.js";
import { createOutboundWorker } from "./infrastructure/queue/bullmq-outbound-worker.js";
import { BaileysGateway } from "./infrastructure/whatsapp/baileys-gateway.js";
import { RedisQrState } from "./infrastructure/whatsapp/qr-state.js";
import { RedisRealtimePublisher } from "./infrastructure/realtime/redis-realtime-publisher.js";
import { createAiProvider } from "./ai/provider-factory.js";
import { createEmbedder } from "./infrastructure/ai/embedder-factory.js";

import { ProcessInboundMessage } from "./use-cases/process-inbound-message.js";
import { RetrieveKnowledge } from "./use-cases/retrieve-knowledge.js";
import { IngestKnowledgeDocument } from "./use-cases/ingest-knowledge-document.js";

const logger = createPinoLogger("backend", CONFIG);

async function bootstrap(): Promise<void> {
  logger.info("Starting WhatsApp backend (gateway + workers)");

  const prisma = getPrismaClient(CONFIG);
  await prisma.$connect();
  logger.info("Database connected");

  const redis = createRedisClient(CONFIG.redisUrl, logger);
  const qrState = new RedisQrState(redis);

  const whatsAppGateway: WhatsAppGateway = new BaileysGateway({
    sessionDir: CONFIG.whatsapp.sessionDir,
    logger: logger.child({ module: "whatsapp" }),
    qrState,
  });

  const aiProvider = createAiProvider(CONFIG.ai, logger.child({ module: "ai" }));
  const embedder = createEmbedder(CONFIG.embeddings, logger.child({ module: "embedder" }));

  // Repositories
  const conversationRepo = new PrismaConversationRepository(prisma);
  const messageRepo = new PrismaMessageRepository(prisma);
  const botConfigRepo = new PrismaBotConfigRepository(prisma);
  const allowedNumberRepo = new PrismaAllowedNumberRepository(prisma);
  const knowledgeRepo = new PrismaKnowledgeRepository(prisma);

  // Realtime fan-out (publisher uses the main Redis client; subscribers
  // need their own duplicate connection — done in the SSE handler in web).
  const realtime = new RedisRealtimePublisher(redis, logger.child({ module: "realtime" }));

  // Use cases
  const retrieveKnowledge = new RetrieveKnowledge({
    knowledgeRepo,
    embedder,
    logger: logger.child({ module: "rag-retrieve" }),
  });

  const ingestKnowledgeDocument = new IngestKnowledgeDocument({
    knowledgeRepo,
    embedder,
    logger: logger.child({ module: "rag-ingest" }),
  });

  const processInboundMessage = new ProcessInboundMessage({
    conversationRepo,
    messageRepo,
    aiProvider,
    botConfigRepo,
    allowedNumberRepo,
    whatsAppSender: whatsAppGateway,
    realtime,
    retrieveKnowledge,
    logger: logger.child({ module: "process-inbound" }),
  });

  // Workers
  const inboundWorker = createInboundMessageWorker(
    redis,
    (message) => processInboundMessage.execute(message),
    logger.child({ module: "inbound-worker" })
  );

  const ingestWorker = createKnowledgeIngestWorker(
    redis,
    (job) => ingestKnowledgeDocument.execute(job.documentId),
    logger.child({ module: "ingest-worker" })
  );

  // Outbound queue lets the web container schedule WhatsApp sends
  // (agent replies) without touching the WASocket. Backend owns the socket.
  const outboundWorker = createOutboundWorker(
    redis,
    whatsAppGateway,
    logger.child({ module: "outbound-worker" })
  );

  const messagePublisher = new BullMqMessagePublisher(
    redis,
    logger.child({ module: "queue" })
  );

  whatsAppGateway.onInboundMessage(async (message) => {
    await messagePublisher.publishInbound(message);
  });

  await whatsAppGateway.connect();
  logger.info("WhatsApp gateway connecting — open the web admin to scan QR");

  registerShutdownHandlers(
    prisma,
    redis,
    [inboundWorker, ingestWorker, outboundWorker],
    whatsAppGateway,
    logger
  );
}

function registerShutdownHandlers(
  prisma: PrismaClient,
  redis: Redis,
  workers: Worker[],
  whatsAppGateway: WhatsAppGateway,
  shutdownLogger: Logger
): void {
  const shutdown = async (signal: string) => {
    shutdownLogger.info("Shutdown initiated", { signal });

    await Promise.all(workers.map((w) => w.close()));
    await whatsAppGateway.disconnect();
    await prisma.$disconnect();
    await redis.quit();

    shutdownLogger.info("Shutdown complete");
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

bootstrap().catch((error) => {
  console.error("Fatal bootstrap error:", error);
  process.exit(1);
});
