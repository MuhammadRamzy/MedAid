/**
 * Suggests an unused asset tag in the KMCC-{PREFIX}-{3 digits} format
 * (e.g. "KMCC-MOB-284" for "Mobility"), given the category being
 * registered and every asset tag already in the inventory. The caller is
 * responsible for fetching that list — this function is pure so it's
 * testable without Firestore.
 *
 * Returns null only if all 900 numbers (100-999) for that category prefix
 * are already taken — the UI falls back to asking for a manual tag rather
 * than looping forever.
 */
export function suggestAssetTag(category: string, existingTags: string[]): string | null {
  const prefix = (category.trim().substring(0, 3) || "GEN").toUpperCase();
  const used = new Set(
    existingTags
      .filter((tag) => tag.toUpperCase().startsWith(`KMCC-${prefix}-`))
      .map((tag) => tag.slice(-3))
  );

  const available: string[] = [];
  for (let n = 100; n <= 999; n++) {
    const key = String(n);
    if (!used.has(key)) available.push(key);
  }
  if (available.length === 0) return null;

  const pick = available[Math.floor(Math.random() * available.length)];
  return `KMCC-${prefix}-${pick}`;
}
