/**
 * Receipt numbers come from a persisted counter, never from a collection
 * count. A count-based scheme reuses numbers after any deletion, on a
 * document the beneficiary keeps.
 */
export function formatReceiptNumber(year: number, seq: number): string {
  return `QID-${year}-${String(seq).padStart(4, "0")}`;
}

export function nextSequence(
  current: { year: number; seq: number } | null,
  year: number
): number {
  if (!current || current.year !== year) return 1;
  return current.seq + 1;
}
