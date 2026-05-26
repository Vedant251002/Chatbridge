import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { getQrSnapshot, qrRequestChannel } from "@/lib/qr-state";
import { redis } from "@/lib/redis";
import { requireUser, UnauthorizedError } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const { status, qrString } = await getQrSnapshot(user.id);

    if (status !== "ready" || !qrString) {
      return NextResponse.json({ status, qrImage: null });
    }

    const qrImage = await QRCode.toDataURL(qrString, {
      width: 400,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    });

    return NextResponse.json({ status, qrImage });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not signed in" } },
        { status: 401 }
      );
    }
    throw error;
  }
}

// POST /api/qr → ask the backend to mint a fresh QR for this user. The
// Baileys process subscribes to whatsapp:qr:request:* and opens a per-user
// socket on demand.
export async function POST() {
  try {
    const user = await requireUser();
    await redis.publish(qrRequestChannel(user.id), "1");
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not signed in" } },
        { status: 401 }
      );
    }
    throw error;
  }
}
