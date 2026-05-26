import type { AllowedNumber } from "../entities/allowed-number.js";

export interface AllowedNumberRepository {
  list(): Promise<AllowedNumber[]>;
  add(phone: string, label: string | null): Promise<AllowedNumber>;
  remove(id: string): Promise<void>;
  isAllowed(phone: string): Promise<boolean>;
  count(): Promise<number>;
}
