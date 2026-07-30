import { describe, it, expect } from "vitest";
import { validateAcquisition } from "./acquisition";

describe("validateAcquisition", () => {
  it("accepts a complete purchase record", () => {
    const result = validateAcquisition({
      source: "purchase",
      invoiceNumber: "INV-2026-001",
      supplier: "Kerala Medical Supplies",
      price: 12500,
      sourceOfFund: "General Fund",
    });
    expect(result.valid).toBe(true);
  });

  it("accepts a complete donation record", () => {
    const result = validateAcquisition({
      source: "donation",
      contributorName: "Anonymous Donor",
      estimatedValue: 8000,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a purchase missing the invoice number", () => {
    const result = validateAcquisition({
      source: "purchase",
      invoiceNumber: "",
      supplier: "Kerala Medical Supplies",
      price: 12500,
      sourceOfFund: "General Fund",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a purchase with a zero or negative price", () => {
    const result = validateAcquisition({
      source: "purchase",
      invoiceNumber: "INV-2026-001",
      supplier: "Kerala Medical Supplies",
      price: 0,
      sourceOfFund: "General Fund",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a donation missing the contributor name", () => {
    const result = validateAcquisition({
      source: "donation",
      contributorName: "  ",
      estimatedValue: 8000,
    });
    expect(result.valid).toBe(false);
  });

  it("accepts a donation with no estimated value given", () => {
    const result = validateAcquisition({
      source: "donation",
      contributorName: "Anonymous Donor",
      estimatedValue: null,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects an unrecognized source", () => {
    const result = validateAcquisition({ source: "gift" });
    expect(result.valid).toBe(false);
  });

  it("rejects a non-object input", () => {
    const result = validateAcquisition(null);
    expect(result.valid).toBe(false);
  });
});
