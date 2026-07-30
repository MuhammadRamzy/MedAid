import { describe, it, expect } from "vitest";
import { statusForCondition } from "./condition";

describe("statusForCondition", () => {
  it("makes a new device available", () => {
    expect(statusForCondition("New")).toBe("AVAILABLE");
  });

  it("makes a used device available", () => {
    expect(statusForCondition("Used")).toBe("AVAILABLE");
  });

  it("makes a good device available", () => {
    expect(statusForCondition("Good")).toBe("AVAILABLE");
  });

  it("makes a fair device available", () => {
    expect(statusForCondition("Fair")).toBe("AVAILABLE");
  });

  it("sends a device needing repair to maintenance", () => {
    expect(statusForCondition("Needs Repair")).toBe("MAINTENANCE");
  });

  it("retires a retired device", () => {
    expect(statusForCondition("Retired")).toBe("RETIRED");
  });
});
