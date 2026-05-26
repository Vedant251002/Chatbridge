import { join } from "path";
import type { Redis } from "ioredis";
import type { Logger } from "../../domain/ports/logger.js";
import type { InboundMessage } from "../../domain/entities/inbound-message.js";
import type { WhatsAppSender } from "../../domain/ports/whatsapp-sender.js";
import { BaileysGateway } from "./baileys-gateway.js";
import { RedisQrState, type QrSnapshot } from "./qr-state.js";

// One Baileys socket per user. The manager owns the lifecycle (boot existing
// users from disk, mint new gateways on demand from the QR endpoint) and
// fan-outs senders/QR state by userId for everything else in the process.
export class WhatsAppGatewayManager {
  private readonly gateways = new Map<string, BaileysGateway>();

  constructor(
    private readonly opts: {
      baseSessionDir: string;
      logger: Logger;
      redis: Redis;
      onInboundMessage: (message: InboundMessage) => Promise<void>;
    }
  ) {}

  /**
   * Boots gateways for users who have an existing session on disk. Each
   * userId gets its own subdirectory under baseSessionDir. New users with
   * no on-disk session are handled lazily via {@link requestQr}.
   */
  async bootExistingSessions(userIds: string[]): Promise<void> {
    await Promise.all(
      userIds.map(async (userId) => {
        const gateway = this.getOrCreate(userId);
        try {
          await gateway.connect();
        } catch (error) {
          this.opts.logger.error("Failed to boot gateway", {
            userId,
            error: String(error),
          });
        }
      })
    );
  }

  getSender(userId: string): WhatsAppSender | null {
    const gateway = this.gateways.get(userId);
    if (!gateway || !gateway.isConnected()) return null;
    return gateway;
  }

  async requestQr(userId: string): Promise<void> {
    const gateway = this.getOrCreate(userId);
    await gateway.requestQr();
  }

  async getQrSnapshot(userId: string): Promise<QrSnapshot> {
    const qrState = new RedisQrState(this.opts.redis, userId);
    return qrState.get();
  }

  async disconnectAll(): Promise<void> {
    await Promise.all(
      Array.from(this.gateways.values()).map((g) => g.disconnect())
    );
    this.gateways.clear();
  }

  private getOrCreate(userId: string): BaileysGateway {
    const existing = this.gateways.get(userId);
    if (existing) return existing;

    const sessionDir = join(this.opts.baseSessionDir, userId);
    const qrState = new RedisQrState(this.opts.redis, userId);
    const gateway = new BaileysGateway({
      userId,
      sessionDir,
      logger: this.opts.logger.child({ module: "whatsapp", userId }),
      qrState,
    });
    gateway.onInboundMessage(this.opts.onInboundMessage);
    this.gateways.set(userId, gateway);
    return gateway;
  }
}
