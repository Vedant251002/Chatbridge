import { Queue } from "bullmq";
import { redis } from "./redis";

declare global {
  var __outboundQueue: Queue<OutboundJob> | undefined;
  var __ingestQueue: Queue<IngestJob> | undefined;
}

export interface OutboundJob {
  // Identifies which user's WhatsApp socket should send. Required so the
  // backend's outbound worker can resolve the right gateway.
  userId: string;
  jid: string;
  text: string;
  conversationId?: string;
}

export interface IngestJob {
  documentId: string;
}

const Q_OUTBOUND = "outbound-messages";
const Q_INGEST = "knowledge-ingest";

export const outboundQueue: Queue<OutboundJob> =
  globalThis.__outboundQueue ?? new Queue<OutboundJob>(Q_OUTBOUND, { connection: redis });

export const ingestQueue: Queue<IngestJob> =
  globalThis.__ingestQueue ?? new Queue<IngestJob>(Q_INGEST, { connection: redis });

if (process.env.NODE_ENV !== "production") {
  globalThis.__outboundQueue = outboundQueue;
  globalThis.__ingestQueue = ingestQueue;
}

export async function enqueueOutbound(job: OutboundJob): Promise<void> {
  await outboundQueue.add("send", job, {
    attempts: 5,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  });
}

export async function enqueueIngest(documentId: string): Promise<void> {
  await ingestQueue.add(
    "ingest",
    { documentId },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: 50,
      removeOnFail: 50,
    }
  );
}

function sanitizePhone(phone: string): string {
  const digits = phone.replace(/[\s\-().]/g, "");
  return digits.startsWith("+") ? digits : `+${digits}`;
}

export function phoneToJid(phone: string): string {
  const digits = sanitizePhone(phone).replace(/^\+/, "");
  return `${digits}@s.whatsapp.net`;
}
