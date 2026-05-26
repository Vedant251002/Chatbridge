import type { WASocket } from "@whiskeysockets/baileys";
import { WhatsAppError } from "../../utils/errors.js";
import type { Logger } from "../../domain/ports/logger.js";

const WHATSAPP_JID_SUFFIX = "@s.whatsapp.net";

export async function sendWhatsAppMessage(
  sock: WASocket,
  phoneOrJid: string,
  text: string,
  logger: Logger
): Promise<void> {
  const jid = toWhatsAppJid(phoneOrJid);

  try {
    await sock.sendMessage(jid, { text });
    logger.debug("WhatsApp message sent", { jid });
  } catch (error) {
    throw new WhatsAppError(`Failed to send message to ${phoneOrJid}`, error);
  }
}

function toWhatsAppJid(phoneOrJid: string): string {
  if (phoneOrJid.includes("@")) return phoneOrJid;
  const digits = phoneOrJid.replace(/^\+/, "");
  return `${digits}${WHATSAPP_JID_SUFFIX}`;
}
