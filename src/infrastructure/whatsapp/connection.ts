import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  type AuthenticationState,
  type ConnectionState,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import { readdir, rm } from "fs/promises";
import { join } from "path";
import type { Logger } from "../../domain/ports/logger.js";
import type { RedisQrState } from "./qr-state.js";

const RECONNECT_DELAY_MS = 5_000;
// WhatsApp invalidates a QR roughly every minute. We pin the first QR for
// this long, then flip back to "waiting" so the admin can request a new one.
const QR_VISIBLE_MS = 60_000;

export interface BaileysSocketConfig {
  logger: Logger;
}

export async function createBaileysSocket(
  config: BaileysSocketConfig,
  creds: AuthenticationState
) {
  const { version, isLatest } = await fetchLatestBaileysVersion();
  config.logger.info("Baileys version fetched", { version: version.join("."), isLatest });

  return makeWASocket({
    version,
    auth: creds,
    browser: Browsers.ubuntu("Chrome"),
    logger: createBaileysLogger(config.logger),
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
  });
}

export interface ConnectionUpdateContext {
  qrState: RedisQrState;
  reconnect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sessionDir: string;
  logger: Logger;
  // Set true once we've captured the first QR for this socket session.
  // Subsequent QR emissions are ignored until the socket is torn down.
  qrCaptured: { current: boolean };
}

export async function handleConnectionUpdate(
  update: Partial<ConnectionState>,
  ctx: ConnectionUpdateContext
): Promise<void> {
  const { connection, lastDisconnect } = update;

  if (update.qr) {
    if (ctx.qrCaptured.current) {
      // Baileys mints a fresh QR every ~20s while unpaired. We ignore the
      // refreshes so the user isn't chasing a moving target. After
      // QR_VISIBLE_MS we tear the socket down and let the admin request a
      // new code explicitly.
      return;
    }

    ctx.qrCaptured.current = true;
    await ctx.qrState.setQrString(update.qr);
    await logTerminalQr(update.qr, ctx.logger);
    ctx.logger.info("QR ready — open the web admin page to scan");

    setTimeout(() => {
      void expireQr(ctx);
    }, QR_VISIBLE_MS);
  }

  if (connection === "open") {
    await ctx.qrState.setConnected();
    ctx.logger.info("WhatsApp connection opened");
    return;
  }

  if (connection !== "close") return;

  // Reflect the drop in the shared QR state right away so the web admin
  // stops reporting "connected" while we're actually offline.
  await ctx.qrState.setWaiting();

  const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })
    ?.output?.statusCode;

  if (statusCode === DisconnectReason.loggedOut) {
    ctx.logger.warn("WhatsApp logged out from device — clearing session and waiting for QR request");
    try {
      await clearSessionDir(ctx.sessionDir);
    } catch (error) {
      ctx.logger.error("Failed to clear session directory", { error: String(error) });
    }
    // Don't auto-reconnect: we only mint a new QR when the admin asks.
    return;
  }

  if (statusCode === DisconnectReason.connectionReplaced) {
    // Another WhatsApp Web / Baileys session paired with the same number
    // and stole this socket's slot. Reconnecting just bounces the other
    // side and triggers an infinite kick-war. Stop and wait for the admin
    // to either close the duplicate session or click "Regenerate QR".
    ctx.logger.error(
      "WhatsApp session was replaced by another login — stopping reconnects. " +
        "Close any other WhatsApp Web tabs / Baileys instances using this " +
        "number, then click Regenerate QR in the admin UI."
    );
    return;
  }

  ctx.logger.warn("WhatsApp reconnecting...", { statusCode });
  await new Promise((resolve) => setTimeout(resolve, RECONNECT_DELAY_MS));
  await ctx.reconnect();
}

async function expireQr(ctx: ConnectionUpdateContext): Promise<void> {
  const snapshot = await ctx.qrState.get();
  if (snapshot.status !== "ready") return;

  ctx.logger.info("QR expired — tearing down socket, waiting for new request");
  try {
    await ctx.disconnect();
  } catch (error) {
    ctx.logger.warn("Failed to tear down socket on QR expiry", {
      error: String(error),
    });
  }
  await ctx.qrState.setWaiting();
}

async function logTerminalQr(qr: string, logger: Logger): Promise<void> {
  try {
    const terminalQr = await QRCode.toString(qr, { type: "terminal", small: true });
    logger.info(`\n${terminalQr}`);
  } catch (error) {
    logger.warn("Failed to render QR in logs", { error: String(error) });
  }
}

// Removes the *contents* of the session directory rather than the directory
// itself, which matters because in Docker the folder is a bind-mounted volume
// and rmdir on the mount point fails with EBUSY.
async function clearSessionDir(sessionDir: string): Promise<void> {
  const entries = await readdir(sessionDir);
  await Promise.all(
    entries.map((entry) =>
      rm(join(sessionDir, entry), { recursive: true, force: true })
    )
  );
}

function createBaileysLogger(appLogger: Logger) {
  return {
    level: "silent",
    trace: () => {},
    debug: () => {},
    info: (msg: Record<string, unknown>, message: string) => appLogger.debug(message, msg),
    warn: (msg: Record<string, unknown>, message: string) => appLogger.warn(message, msg),
    error: (msg: Record<string, unknown>, message: string) => appLogger.error(message, msg),
    fatal: (msg: Record<string, unknown>, message: string) => appLogger.error(message, msg),
    child: () => createBaileysLogger(appLogger),
  };
}
