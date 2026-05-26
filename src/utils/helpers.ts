import { createHash } from "crypto";

const WHATSAPP_JID_SUFFIX = "@s.whatsapp.net";

export function buildThreadId(phone: string): string {
  const hash = createHash("sha256").update(phone).digest("hex").slice(0, 8);
  return `thread_${hash}_${phone}`;
}

export function sanitizePhone(phone: string): string {
  const digits = phone.replace(/[\s\-().]/g, "");
  return digits.startsWith("+") ? digits : `+${digits}`;
}

export function phoneToJid(phoneOrJid: string): string {
  if (phoneOrJid.includes("@")) return phoneOrJid;
  const digits = sanitizePhone(phoneOrJid).replace(/^\+/, "");
  return `${digits}${WHATSAPP_JID_SUFFIX}`;
}
