import type { WASocket } from "@whiskeysockets/baileys";
import type { Logger } from "../../domain/ports/logger.js";
import type { WhatsAppSender } from "../../domain/ports/whatsapp-sender.js";
import type { InboundMessage } from "../../domain/entities/inbound-message.js";
import { createSessionStore } from "./session-store.js";
import { createBaileysSocket, handleConnectionUpdate } from "./connection.js";
import { registerInboundListener, type InboundFromSocket } from "./listener.js";
import { sendWhatsAppMessage } from "./sender.js";
import type { RedisQrState } from "./qr-state.js";

export interface BaileysGatewayConfig {
  // Identifies the user that owns this socket. One Baileys process holds
  // many gateways — one per signed-in user — keyed by userId.
  userId: string;
  sessionDir: string;
  logger: Logger;
  qrState: RedisQrState;
}

// Per-user WhatsApp gateway. Implements the narrower WhatsAppSender so
// downstream code can send replies through it.
export class BaileysGateway implements WhatsAppSender {
  private sock: WASocket | null = null;
  private inboundHandler: ((message: InboundMessage) => Promise<void>) | null = null;
  private listenerAttached = false;
  private connecting = false;
  // Per-socket flag: true once we've captured & exposed the first QR for the
  // current connection attempt. Reset on every fresh connect().
  private qrCaptured = { current: false };

  constructor(private readonly config: BaileysGatewayConfig) {}

  /**
   * Boot-time entrypoint. Only opens the WhatsApp socket if we already have
   * paired credentials on disk. First-time users have to explicitly request
   * a QR via {@link requestQr} from the admin UI — we don't want to mint a
   * new QR every 20s in the background.
   */
  async connect(): Promise<void> {
    const { state } = await createSessionStore(this.config.sessionDir);

    if (!state.creds.registered) {
      this.config.logger.info(
        "No paired credentials found — staying idle until QR is requested"
      );
      await this.config.qrState.setWaiting();
      return;
    }

    await this.openSocket();
  }

  /**
   * Admin-triggered. Tears down any existing socket and opens a new one so
   * Baileys emits a fresh QR.
   */
  async requestQr(): Promise<void> {
    if (this.connecting) {
      this.config.logger.info("QR request ignored — connection already in progress");
      return;
    }

    if (this.sock) {
      try {
        await this.disconnect();
      } catch (error) {
        this.config.logger.warn("Failed to tear down previous socket", {
          error: String(error),
        });
      }
    }

    await this.config.qrState.setWaiting();
    await this.openSocket();
  }

  onInboundMessage(handler: (message: InboundMessage) => Promise<void>): void {
    this.inboundHandler = handler;
    this.attachListener();
  }

  async sendMessage(phoneOrJid: string, text: string): Promise<void> {
    if (!this.sock) throw new Error("WhatsApp gateway is not connected");
    await sendWhatsAppMessage(this.sock, phoneOrJid, text, this.config.logger);
  }

  isConnected(): boolean {
    return this.sock !== null;
  }

  async disconnect(): Promise<void> {
    const sock = this.sock;
    this.sock = null;
    this.listenerAttached = false;
    if (!sock) return;
    try {
      sock.end(undefined);
    } catch {
      // end() errors are non-fatal
    }
  }

  private async openSocket(): Promise<void> {
    this.connecting = true;
    try {
      const { state, saveCreds } = await createSessionStore(this.config.sessionDir);

      this.sock = await createBaileysSocket(this.config, state);
      this.listenerAttached = false;
      this.qrCaptured = { current: false };

      this.sock.ev.on("creds.update", saveCreds);
      this.sock.ev.on("connection.update", (update) =>
        handleConnectionUpdate(update, {
          qrState: this.config.qrState,
          reconnect: () => this.openSocket(),
          disconnect: () => this.disconnect(),
          sessionDir: this.config.sessionDir,
          logger: this.config.logger,
          qrCaptured: this.qrCaptured,
        })
      );

      this.attachListener();
    } finally {
      this.connecting = false;
    }
  }

  private attachListener(): void {
    if (!this.sock || !this.inboundHandler || this.listenerAttached) return;
    const handler = this.inboundHandler;
    const userId = this.config.userId;
    const onSocketMessage: InboundFromSocket = async (raw) => {
      // Decorate the listener-shaped message with the owning user id so
      // the downstream worker can route to per-user repos.
      await handler({ ...raw, userId });
    };
    registerInboundListener(this.sock, onSocketMessage, this.config.logger);
    this.listenerAttached = true;
  }
}
