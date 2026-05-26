import type { PrismaClient } from "@prisma/client";
import { DatabaseError } from "../../utils/errors.js";
import type { AllowedNumberRepository } from "../../domain/ports/allowed-number-repository.js";
import type { AllowedNumber } from "../../domain/entities/allowed-number.js";

export class PrismaAllowedNumberRepository implements AllowedNumberRepository {
  constructor(private readonly db: PrismaClient) {}

  async list(): Promise<AllowedNumber[]> {
    try {
      return await this.db.allowedNumber.findMany({ orderBy: { createdAt: "desc" } });
    } catch (error) {
      throw new DatabaseError("Failed to list allowed numbers", error);
    }
  }

  async add(phone: string, label: string | null): Promise<AllowedNumber> {
    try {
      return await this.db.allowedNumber.create({ data: { phone, label } });
    } catch (error) {
      throw new DatabaseError("Failed to add allowed number", error);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.db.allowedNumber.delete({ where: { id } });
    } catch (error) {
      throw new DatabaseError("Failed to remove allowed number", error);
    }
  }

  async isAllowed(phone: string): Promise<boolean> {
    try {
      // Normalize to digits-only so different formats compare equal:
      //   "+1 (555) 123-4567", "15551234567", "+15551234567" → 15551234567
      const digits = phone.replace(/\D/g, "");
      if (!digits) return false;

      const all = await this.db.allowedNumber.findMany({
        select: { phone: true },
      });

      // Accept exact digit match, or a suffix match when the shorter side
      // is long enough to be a real national number (≥8 digits). This
      // handles the common case where the admin saves "+91…" but Baileys
      // delivers it without the "+", or vice versa.
      return all.some((row) => {
        const stored = row.phone.replace(/\D/g, "");
        if (!stored) return false;
        if (stored === digits) return true;
        const shorter = stored.length < digits.length ? stored : digits;
        const longer = stored.length < digits.length ? digits : stored;
        return shorter.length >= 8 && longer.endsWith(shorter);
      });
    } catch (error) {
      throw new DatabaseError("Failed to check allowed number", error);
    }
  }

  async count(): Promise<number> {
    try {
      return await this.db.allowedNumber.count();
    } catch (error) {
      throw new DatabaseError("Failed to count allowed numbers", error);
    }
  }
}
