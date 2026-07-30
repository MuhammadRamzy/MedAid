import { describe, it, expect } from "vitest";
import { formatReceiptNumber, nextSequence } from "./receipt";

describe("formatReceiptNumber", () => {
  it("pads the sequence to four digits", () => {
    expect(formatReceiptNumber(2026, 1)).toBe("QID-2026-0001");
  });

  it("does not truncate sequences beyond four digits", () => {
    expect(formatReceiptNumber(2026, 12345)).toBe("QID-2026-12345");
  });
});

describe("nextSequence", () => {
  it("starts at one when no counter exists", () => {
    expect(nextSequence(null, 2026)).toBe(1);
  });

  it("increments within the same year", () => {
    expect(nextSequence({ year: 2026, seq: 7 }, 2026)).toBe(8);
  });

  it("restarts at one in a new year", () => {
    expect(nextSequence({ year: 2025, seq: 400 }, 2026)).toBe(1);
  });
});
