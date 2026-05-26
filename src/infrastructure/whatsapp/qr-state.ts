import type { Redis } from "ioredis";

export type QrStatus = "waiting" | "ready" | "connected";

export interface QrSnapshot {
  status: QrStatus;
  qrString: string | null;
}

const KEY_STATUS = "whatsapp:qr:status";
const KEY_QR = "whatsapp:qr:string";
const QR_TTL_SECONDS = 120; // QR codes expire on WhatsApp's side ~60s; double it for safety

// Backed by Redis so the Next.js process can read the same state the
// Baileys backend writes. No more module-level singletons.
export class RedisQrState {
  constructor(private readonly redis: Redis) {}

  async setQrString(qr: string): Promise<void> {
    await this.redis
      .multi()
      .set(KEY_STATUS, "ready")
      .set(KEY_QR, qr, "EX", QR_TTL_SECONDS)
      .exec();
  }

  async setConnected(): Promise<void> {
    await this.redis.multi().set(KEY_STATUS, "connected").del(KEY_QR).exec();
  }

  async setWaiting(): Promise<void> {
    await this.redis.multi().set(KEY_STATUS, "waiting").del(KEY_QR).exec();
  }

  async get(): Promise<QrSnapshot> {
    const [status, qr] = await this.redis.mget(KEY_STATUS, KEY_QR);
    return {
      status: (status as QrStatus | null) ?? "waiting",
      qrString: qr ?? null,
    };
  }
}
