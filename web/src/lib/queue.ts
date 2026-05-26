import { Queue } from "bullmq";
import { redis } from "./redis";

declare global {
  var __inboundQueue: Queue<InboundJob> | undefined;
  var __outboundQueue: Queue<OutboundJob> | undefined;
  var __ingestQueue: Queue<IngestJob> | undefined;
}

export interface InboundJob {
  phone: string;
  jid: string;
  text: string;
  timestamp: number;
  messageId: string;
}

export interface OutboundJob {
  jid: string;
  text: string;
  conversationId?: string;
}

export interface IngestJob {
  documentId: string;
}

const Q_INBOUND = "inbound-messages";
const Q_OUTBOUND = "outbound-messages";
const Q_INGEST = "knowledge-ingest";

export const inboundQueue: Queue<InboundJob> =
  globalThis.__inboundQueue ?? new Queue<InboundJob>(Q_INBOUND, { connection: redis });

export const outboundQueue: Queue<OutboundJob> =
  globalThis.__outboundQueue ?? new Queue<OutboundJob>(Q_OUTBOUND, { connection: redis });

export const ingestQueue: Queue<IngestJob> =
  globalThis.__ingestQueue ?? new Queue<IngestJob>(Q_INGEST, { connection: redis });

if (process.env.NODE_ENV !== "production") {
  globalThis.__inboundQueue = inboundQueue;
  globalThis.__outboundQueue = outboundQueue;
  globalThis.__ingestQueue = ingestQueue;
}

export async function enqueueAdminInitiated(input: {
  phone: string;
  text: string;
}): Promise<string | undefined> {
  const jid = phoneToJid(input.phone);
  const job = await inboundQueue.add(
    "process",
    {
      phone: sanitizePhone(input.phone),
      jid,
      text: input.text,
      timestamp: Date.now(),
      messageId: `admin_${Date.now()}`,
    },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 2_000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    }
  );
  return job.id;
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
