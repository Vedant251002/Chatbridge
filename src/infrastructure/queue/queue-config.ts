export const QUEUE_NAMES = {
  INBOUND_MESSAGES: "inbound-messages",
  KNOWLEDGE_INGEST: "knowledge-ingest",
} as const;

export const QUEUE_OPTIONS = {
  attempts: 3,
  backoffDelayMs: 2_000,
  workerConcurrency: 5,
  removeOnComplete: 100,
  removeOnFail: 50,
} as const;

export const INGEST_QUEUE_OPTIONS = {
  attempts: 3,
  backoffDelayMs: 5_000,
  workerConcurrency: 2,
  removeOnComplete: 50,
  removeOnFail: 50,
} as const;
