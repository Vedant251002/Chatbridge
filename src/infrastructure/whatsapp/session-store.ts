import { mkdir } from "fs/promises";
import { useMultiFileAuthState } from "@whiskeysockets/baileys";
import { WhatsAppError } from "../../utils/errors.js";

export async function createSessionStore(sessionDir: string) {
  try {
    await mkdir(sessionDir, { recursive: true });
    return await useMultiFileAuthState(sessionDir);
  } catch (error) {
    throw new WhatsAppError(
      `Failed to initialize session store at '${sessionDir}'`,
      error
    );
  }
}
