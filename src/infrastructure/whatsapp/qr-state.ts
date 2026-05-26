import type { Redis } from "ioredis";

export type QrStatus = "waiting" | "ready" | "connected";

export interface QrSnapshot {
  status: QrStatus;
  qrString: string | null;
}

const QR_TTL_SECONDS = 120; // QR codes expire on WhatsApp's side ~60s; double it for safety

function statusKey(userId: string): string {
  return `whatsapp:qr:${userId}:status`;
}

function qrKey(userId: string): string {
  return `whatsapp:qr:${userId}:string`;
}

// Per-user QR state in Redis. Each user's WhatsApp gateway writes here;
// the web Next.js process reads via getQrSnapshot for the same user.
export class RedisQrState {
  constructor(private readonly redis: Redis, private readonly userId: string) {}

  async setQrString(qr: string): Promise<void> {
    await this.redis
      .multi()
      .set(statusKey(this.userId), "ready")
      .set(qrKey(this.userId), qr, "EX", QR_TTL_SECONDS)
      .exec();
  }

  async setConnected(): Promise<void> {
    await this.redis
      .multi()
      .set(statusKey(this.userId), "connected")
      .del(qrKey(this.userId))
      .exec();
  }

  async setWaiting(): Promise<void> {
    await this.redis
      .multi()
      .set(statusKey(this.userId), "waiting")
      .del(qrKey(this.userId))
      .exec();
  }

  async get(): Promise<QrSnapshot> {
    const [status, qr] = await this.redis.mget(statusKey(this.userId), qrKey(this.userId));
    return {
      status: (status as QrStatus | null) ?? "waiting",
      qrString: qr ?? null,
    };
  }
}
