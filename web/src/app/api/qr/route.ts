import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { getQrSnapshot } from "@/lib/qr-state";

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
