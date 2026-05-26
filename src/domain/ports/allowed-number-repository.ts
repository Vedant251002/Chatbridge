import type { AllowedNumber } from "../entities/allowed-number.js";

export interface AllowedNumberRepository {
  list(userId: string): Promise<AllowedNumber[]>;
  add(userId: string, phone: string, label: string | null): Promise<AllowedNumber>;
  remove(id: string): Promise<void>;
  // Allowlist gate is per user — only that user's list can authorize the AI.
  isAllowed(userId: string, phone: string): Promise<boolean>;
  count(userId: string): Promise<number>;
}
