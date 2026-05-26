import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { getQrSnapshot } from "@/lib/qr-state";
import { redis } from "@/lib/redis";

export async function GET() {
  const { status, qrString } = await getQrSnapshot();

  if (status !== "ready" || !qrString) {
    return NextResponse.json({ status, qrImage: null });
  }

  const qrImage = await QRCode.toDataURL(qrString, {
    width: 400,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });

  return NextResponse.json({ status, qrImage });
}

// POST /api/qr → ask the backend to mint a fresh QR. The Baileys process
// listens on the `whatsapp:qr:request` channel and (re)opens its socket.
export async function POST() {
  await redis.publish("whatsapp:qr:request", "1");
  return NextResponse.json({ ok: true });
}
