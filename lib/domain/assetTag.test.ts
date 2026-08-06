import { describe, it, expect } from "vitest";
import { suggestAssetTag } from "./assetTag";

describe("suggestAssetTag", () => {
  it("suggests a tag in the KMCC-{PREFIX}-{3 digits} format", () => {
    const tag = suggestAssetTag("Mobility", []);
    expect(tag).toMatch(/^KMCC-MOB-\d{3}$/);
  });

  it("never suggests a tag that's already in use", () => {
    const existing = ["KMCC-MOB-100", "KMCC-MOB-284", "KMCC-OXY-500"];
    for (let i = 0; i < 100; i++) {
      const tag = suggestAssetTag("Mobility", existing);
      expect(existing).not.toContain(tag);
    }
  });

  it("is case-insensitive when checking for collisions", () => {
    const existing = ["kmcc-mob-100"];
    for (let i = 0; i < 50; i++) {
      const tag = suggestAssetTag("Mobility", existing);
      expect(tag?.toLowerCase()).not.toBe("kmcc-mob-100");
    }
  });

  it("ignores tags from other category prefixes", () => {
    const existing = ["KMCC-OXY-100", "KMCC-BED-200"];
    const tag = suggestAssetTag("Mobility", existing);
    expect(tag).toMatch(/^KMCC-MOB-\d{3}$/);
  });

  it("falls back to a GEN prefix for an empty category", () => {
    const tag = suggestAssetTag("", []);
    expect(tag).toMatch(/^KMCC-GEN-\d{3}$/);
  });

  it("returns null once every number for a prefix is taken", () => {
    const existing = Array.from({ length: 900 }, (_, i) => `KMCC-MOB-${i + 100}`);
    expect(suggestAssetTag("Mobility", existing)).toBeNull();
  });
});
