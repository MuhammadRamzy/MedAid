import { describe, it, expect } from "vitest";
import { validateContribution } from "./contribution";

describe("validateContribution", () => {
  it("accepts a complete cash contribution", () => {
    const result = validateContribution({ amount: 500, method: "cash", reference: "" });
    expect(result.valid).toBe(true);
  });

  it("accepts a UPI contribution with a reference", () => {
    const result = validateContribution({ amount: 1200, method: "upi", reference: "UPI/2026/8842" });
    expect(result.valid).toBe(true);
  });

  it("rejects a zero amount", () => {
    const result = validateContribution({ amount: 0, method: "cash", reference: "" });
    expect(result.valid).toBe(false);
  });

  it("rejects a negative amount", () => {
    const result = validateContribution({ amount: -100, method: "cash", reference: "" });
    expect(result.valid).toBe(false);
  });

  it("rejects an unrecognized method", () => {
    const result = validateContribution({ amount: 500, method: "cheque", reference: "" });
    expect(result.valid).toBe(false);
  });

  it("rejects a non-object input", () => {
    const result = validateContribution(undefined);
    expect(result.valid).toBe(false);
  });

  it("defaults a missing reference to an empty string", () => {
    const result = validateContribution({ amount: 500, method: "cash" });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.contribution.reference).toBe("");
  });
});
