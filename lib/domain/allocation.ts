export type AllocationStatus = "ACTIVE" | "RETURNED";
export type DerivedAllocationStatus = AllocationStatus | "OVERDUE";

/**
 * OVERDUE is never stored. It is derived on read from the stored status and
 * the expected return date, so a lapsed deadline needs no background job.
 */
export function deriveStatus(
  stored: AllocationStatus,
  expectedReturnAt: string,
  now: Date
): DerivedAllocationStatus {
  if (stored !== "ACTIVE") return stored;
  return new Date(expectedReturnAt).getTime() < now.getTime() ? "OVERDUE" : "ACTIVE";
}
