import type { WASocket } from "@whiskeysockets/baileys";
import type { Logger } from "../../domain/ports/logger.js";
import type { WhatsAppGateway } from "../../domain/ports/whatsapp-gateway.js";
import type { InboundMessage } from "../../domain/entities/inbound-message.js";
import { createSessionStore } from "./session-store.js";
import { createBaileysSocket, handleConnectionUpdate } from "./connection.js";
import { registerInboundListener } from "./listener.js";
import { sendWhatsAppMessage } from "./sender.js";
import type { RedisQrState } from "./qr-state.js";

export interface BaileysGatewayConfig {
  sessionDir: string;
  logger: Logger;
  qrState: RedisQrState;
}

export class BaileysGateway implements WhatsAppGateway {
  private sock: WASocket | null = null;
  private inboundHandler: ((message: InboundMessage) => Promise<void>) | null = null;
  private listenerAttached = false;

  constructor(private readonly config: BaileysGatewayConfig) {}

  async connect(): Promise<void> {
    const { state, saveCreds } = await createSessionStore(this.config.sessionDir);

    this.sock = await createBaileysSocket(this.config, state);
    this.listenerAttached = false;

    this.sock.ev.on("creds.update", saveCreds);
    this.sock.ev.on("connection.update", (update) =>
      handleConnectionUpdate(update, {
        qrState: this.config.qrState,
        reconnect: () => this.connect(),
        sessionDir: this.config.sessionDir,
        logger: this.config.logger,
      })
    );

    this.attachListener();
  }

  onInboundMessage(handler: (message: InboundMessage) => Promise<void>): void {
    this.inboundHandler = handler;
    this.attachListener();
  }

  async sendMessage(phoneOrJid: string, text: string): Promise<void> {
    if (!this.sock) throw new Error("WhatsApp gateway is not connected");
    await sendWhatsAppMessage(this.sock, phoneOrJid, text, this.config.logger);
  }

  async disconnect(): Promise<void> {
    try {
      await this.sock?.logout();
    } catch {
      // logout errors are non-fatal during shutdown
    } finally {
      this.sock = null;
      this.listenerAttached = false;
    }
  }

  private attachListener(): void {
    if (!this.sock || !this.inboundHandler || this.listenerAttached) return;
    registerInboundListener(this.sock, this.inboundHandler, this.config.logger);
    this.listenerAttached = true;
  }
}
