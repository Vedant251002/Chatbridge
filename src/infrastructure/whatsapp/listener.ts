import type { WASocket, proto } from "@whiskeysockets/baileys";
import type { Logger } from "../../domain/ports/logger.js";
import type { InboundMessage } from "../../domain/entities/inbound-message.js";

export function registerInboundListener(
  sock: WASocket,
  onMessage: (message: InboundMessage) => Promise<void>,
  logger: Logger
): void {
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const raw = messages[0];
    if (!raw) return;

    const message = toInboundMessage(raw);
    if (!message) return;

    try {
      await onMessage(message);
    } catch (error) {
      logger.error("Failed to handle inbound message", {
        error: String(error),
        phone: message.phone,
      });
    }
  });
}

function toInboundMessage(raw: proto.IWebMessageInfo): InboundMessage | null {
  const text = raw.message?.conversation ?? raw.message?.extendedTextMessage?.text;
  if (!text) return null;
  if (raw.key.fromMe) return null;
  if (!raw.key.remoteJid) return null;

  // Baileys augments the message key with phone-number fields that aren't
  // declared in the proto type — `senderPn` (sender phone number) and
  // `participantPn` are populated when the chat JID is a `@lid` so we can
  // still recover the real E.164 number for matching/storage.
  const keyExt = raw.key as unknown as {
    senderPn?: string | null;
    participantPn?: string | null;
  };
  const phoneJid =
    keyExt.senderPn || keyExt.participantPn || raw.key.remoteJid;

  return {
    phone: extractPhoneFromJid(phoneJid),
    jid: raw.key.remoteJid,
    text,
    timestamp: Number(raw.messageTimestamp ?? Date.now()),
    messageId: raw.key.id ?? "",
  };
}

function extractPhoneFromJid(jid: string): string {
  // Baileys can produce JIDs like:
  //   15551234567@s.whatsapp.net           → direct chat
  //   15551234567:5@s.whatsapp.net         → with device suffix
  //   15551234567@lid                      → linked-identity format
  //   <groupid>@g.us                       → group chat (we let the
  //     allowlist filter these out by digit mismatch)
  const beforeAt = jid.split("@")[0] ?? "";
  // Drop the device suffix ":<n>" if present.
  const beforeDevice = beforeAt.split(":")[0] ?? "";
  return beforeDevice;
}
