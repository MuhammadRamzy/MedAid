import { describe, it, expect } from "vitest";
import { isValidPin, generatePin, PIN_LENGTH } from "./pin";

describe("isValidPin", () => {
  it("accepts a 6-digit numeric string", () => {
    expect(isValidPin("049213")).toBe(true);
  });

  it("rejects fewer than 6 digits", () => {
    expect(isValidPin("1234")).toBe(false);
  });

  it("rejects more than 6 digits", () => {
    expect(isValidPin("1234567")).toBe(false);
  });

  it("rejects non-numeric characters", () => {
    expect(isValidPin("12a456")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidPin("")).toBe(false);
  });
});

describe("generatePin", () => {
  it("always produces a valid PIN, including with leading zeros", () => {
    for (let i = 0; i < 200; i++) {
      const pin = generatePin();
      expect(pin).toHaveLength(PIN_LENGTH);
      expect(isValidPin(pin)).toBe(true);
    }
  });
});
