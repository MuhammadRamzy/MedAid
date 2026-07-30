import { describe, it, expect } from "vitest";
import { deriveStatus } from "./allocation";

const NOW = new Date("2026-07-30T12:00:00.000Z");

describe("deriveStatus", () => {
  it("reports an active allocation past its return date as overdue", () => {
    expect(deriveStatus("ACTIVE", "2026-07-01T00:00:00.000Z", NOW)).toBe("OVERDUE");
  });

  it("leaves an active allocation before its return date active", () => {
    expect(deriveStatus("ACTIVE", "2026-08-30T00:00:00.000Z", NOW)).toBe("ACTIVE");
  });

  it("never reports a returned allocation as overdue", () => {
    expect(deriveStatus("RETURNED", "2026-07-01T00:00:00.000Z", NOW)).toBe("RETURNED");
  });

  it("treats the exact return moment as not yet overdue", () => {
    expect(deriveStatus("ACTIVE", NOW.toISOString(), NOW)).toBe("ACTIVE");
  });
});
