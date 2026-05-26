import type { Worker } from "bullmq";
import type { Redis } from "ioredis";
import type { PrismaClient } from "@prisma/client";

import { CONFIG } from "./config.js";
import type { Logger } from "./domain/ports/logger.js";

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
import { WhatsAppGatewayManager } from "./infrastructure/whatsapp/gateway-manager.js";
import { RedisRealtimePublisher } from "./infrastructure/realtime/redis-realtime-publisher.js";
import { createAiProvider } from "./ai/provider-factory.js";
import { createEmbedder } from "./infrastructure/ai/embedder-factory.js";

import { ProcessInboundMessage } from "./use-cases/process-inbound-message.js";
import { RetrieveKnowledge } from "./use-cases/retrieve-knowledge.js";
import { IngestKnowledgeDocument } from "./use-cases/ingest-knowledge-document.js";

const logger = createPinoLogger("backend", CONFIG);

async function bootstrap(): Promise<void> {
  logger.info("Starting WhatsApp backend (multi-user gateway + workers)");

  const prisma = getPrismaClient(CONFIG);
  await prisma.$connect();
  logger.info("Database connected");

  const redis = createRedisClient(CONFIG.redisUrl, logger);

  const aiProvider = createAiProvider(CONFIG.ai, logger.child({ module: "ai" }));
  const embedder = createEmbedder(CONFIG.embeddings, logger.child({ module: "embedder" }));

  // Repositories — stateless, shared across users; tenancy is enforced
  // at the call site by passing userId.
  const conversationRepo = new PrismaConversationRepository(prisma);
  const messageRepo = new PrismaMessageRepository(prisma);
  const botConfigRepo = new PrismaBotConfigRepository(prisma);
  const allowedNumberRepo = new PrismaAllowedNumberRepository(prisma);
  const knowledgeRepo = new PrismaKnowledgeRepository(prisma);

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

  // Inbound publisher — used by per-user listeners to enqueue messages.
  const messagePublisher = new BullMqMessagePublisher(
    redis,
    logger.child({ module: "queue" })
  );

  // Per-user WhatsApp gateways. Each socket pushes inbound jobs to the
  // shared queue with userId attached.
  const gatewayManager = new WhatsAppGatewayManager({
    baseSessionDir: CONFIG.whatsapp.sessionDir,
    logger: logger.child({ module: "gateway-manager" }),
    redis,
    onInboundMessage: async (message) => {
      await messagePublisher.publishInbound(message);
    },
  });

  const processInboundMessage = new ProcessInboundMessage({
    conversationRepo,
    messageRepo,
    aiProvider,
    botConfigRepo,
    allowedNumberRepo,
    getSender: (userId) => gatewayManager.getSender(userId),
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

  const outboundWorker = createOutboundWorker(
    redis,
    (userId) => gatewayManager.getSender(userId),
    logger.child({ module: "outbound-worker" })
  );

  // ─── Boot existing user sessions and listen for new ones ──────────────
  // On startup we open a socket for every user that already has a paired
  // session on disk. Brand new users become connected lazily when they
  // hit the QR endpoint (see qrSubscriber below).
  const users = await prisma.user.findMany({ select: { id: true } });
  await gatewayManager.bootExistingSessions(users.map((u) => u.id));
  logger.info("WhatsApp gateways initialized", { userCount: users.length });

  // Periodically pick up users that signed up after this process booted.
  // The QR endpoint creates them lazily too — this poller just covers the
  // case where a new user has a session dir but never hit the endpoint.
  const knownUserIds = new Set(users.map((u) => u.id));
  const userPoller = setInterval(async () => {
    try {
      const fresh = await prisma.user.findMany({ select: { id: true } });
      const newUsers = fresh.map((u) => u.id).filter((id) => !knownUserIds.has(id));
      for (const id of newUsers) knownUserIds.add(id);
      if (newUsers.length > 0) {
        await gatewayManager.bootExistingSessions(newUsers);
        logger.info("New users detected, gateways primed", { newUsers });
      }
    } catch (error) {
      logger.warn("User poller failed", { error: String(error) });
    }
  }, 30_000);
  userPoller.unref();

  // QR requests come in on `whatsapp:qr:request:<userId>`. Need a
  // dedicated subscriber connection — ioredis can't run subscribe alongside
  // regular commands.
  const qrSubscriber = createRedisClient(
    CONFIG.redisUrl,
    logger.child({ module: "qr-sub" })
  );
  await qrSubscriber.psubscribe("whatsapp:qr:request:*");
  qrSubscriber.on("pmessage", (_pattern, channel) => {
    const userId = channel.split(":").pop();
    if (!userId) return;
    logger.info("QR request received", { userId });
    void gatewayManager.requestQr(userId);
  });

  registerShutdownHandlers(
    prisma,
    redis,
    [inboundWorker, ingestWorker, outboundWorker],
    gatewayManager,
    logger,
    qrSubscriber
  );
}

function registerShutdownHandlers(
  prisma: PrismaClient,
  redis: Redis,
  workers: Worker[],
  gatewayManager: WhatsAppGatewayManager,
  shutdownLogger: Logger,
  qrSubscriber: Redis
): void {
  const shutdown = async (signal: string) => {
    shutdownLogger.info("Shutdown initiated", { signal });

    await Promise.all(workers.map((w) => w.close()));
    await gatewayManager.disconnectAll();
    await qrSubscriber.quit();
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

// Baileys runs encrypted-message retries on its own async queue. When the
// socket has just been kicked (replaced / device_removed / 401), those
// retries throw `Connection Closed` after our handler has already torn the
// socket down. We log and swallow them so the process stays alive — the
// admin can re-pair from the UI without `docker compose` restarting us.
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", {
    reason: reason instanceof Error ? reason.stack ?? reason.message : String(reason),
  });
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception (kept process alive)", {
    error: error.stack ?? error.message,
  });
});
