import { randomInt } from "crypto";

/**
 * Firebase Auth's password minimum is 6 characters, which is the only value
 * in a "4-6 digit PIN" that actually works against that constraint. Every
 * account — admin-created or Google-provisioned — uses a 6-digit numeric PIN
 * as its Firebase password.
 */
export const PIN_LENGTH = 6;

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

/** A random 6-digit PIN, including leading zeros. */
export function generatePin(): string {
  return String(randomInt(0, 1_000_000)).padStart(PIN_LENGTH, "0");
}
