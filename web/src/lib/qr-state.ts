import { redis } from "./redis";

export type QrStatus = "waiting" | "ready" | "connected";

export interface QrSnapshot {
  status: QrStatus;
  qrString: string | null;
}

function statusKey(userId: string): string {
  return `whatsapp:qr:${userId}:status`;
}

function qrKey(userId: string): string {
  return `whatsapp:qr:${userId}:string`;
}

// Read-only on this side. The Baileys backend writes; the web app reads,
// scoped to the signed-in user.
export async function getQrSnapshot(userId: string): Promise<QrSnapshot> {
  const [status, qr] = await redis.mget(statusKey(userId), qrKey(userId));
  return {
    status: (status as QrStatus | null) ?? "waiting",
    qrString: qr ?? null,
  };
}

export function qrRequestChannel(userId: string): string {
  return `whatsapp:qr:request:${userId}`;
}
