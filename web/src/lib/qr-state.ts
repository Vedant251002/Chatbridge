import { redis } from "./redis";

export type QrStatus = "waiting" | "ready" | "connected";

export interface QrSnapshot {
  status: QrStatus;
  qrString: string | null;
}

const KEY_STATUS = "whatsapp:qr:status";
const KEY_QR = "whatsapp:qr:string";

// Read-only on this side. The Baileys backend writes; the web app reads.
export async function getQrSnapshot(): Promise<QrSnapshot> {
  const [status, qr] = await redis.mget(KEY_STATUS, KEY_QR);
  return {
    status: (status as QrStatus | null) ?? "waiting",
    qrString: qr ?? null,
  };
}
