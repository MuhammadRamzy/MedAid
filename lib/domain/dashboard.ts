import type { ItemStatus } from "./condition";
import type { DerivedAllocationStatus } from "./allocation";
import type { Item, AllocationWithRefs, Beneficiary, Contribution } from "@/lib/types";

export interface DashboardStats {
  totalBeneficiaries: number;
  totalDevices: number;
  devicesByStatus: Record<ItemStatus, number>;
  allocationsByStatus: Record<DerivedAllocationStatus, number>;
  /** All-time count of allocations ever created (give-outs). */
  totalGivenOut: number;
  /** All-time count of allocations with an actual return recorded. */
  totalReturned: number;
  givenOutThisMonth: number;
  returnedThisMonth: number;
  totalContributionsInr: number;
}

const EMPTY_ITEM_STATUS: Record<ItemStatus, number> = {
  AVAILABLE: 0,
  ALLOCATED: 0,
  MAINTENANCE: 0,
  RETIRED: 0,
};

const EMPTY_ALLOCATION_STATUS: Record<DerivedAllocationStatus, number> = {
  ACTIVE: 0,
  OVERDUE: 0,
  RETURNED: 0,
};

function isSameMonth(isoDate: string, now: Date): boolean {
  const d = new Date(isoDate);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

/**
 * Pure aggregation over already-fetched data — no Firestore here, so this is
 * unit-testable with plain fixtures. The caller (a server action) is
 * responsible for fetching items/allocations/beneficiaries/contributions and
 * for admin-gating access to the numbers.
 */
export function computeDashboardStats(
  items: Item[],
  allocations: AllocationWithRefs[],
  beneficiaries: Beneficiary[],
  contributions: Contribution[],
  now: Date = new Date()
): DashboardStats {
  const devicesByStatus = { ...EMPTY_ITEM_STATUS };
  for (const item of items) {
    devicesByStatus[item.status] += 1;
  }

  const allocationsByStatus = { ...EMPTY_ALLOCATION_STATUS };
  let givenOutThisMonth = 0;
  let returnedThisMonth = 0;
  let totalReturned = 0;

  for (const alloc of allocations) {
    allocationsByStatus[alloc.status] += 1;
    if (isSameMonth(alloc.allocatedAt, now)) givenOutThisMonth += 1;
    if (alloc.actualReturnedAt) {
      totalReturned += 1;
      if (isSameMonth(alloc.actualReturnedAt, now)) returnedThisMonth += 1;
    }
  }

  const totalContributionsInr = contributions.reduce((sum, c) => sum + c.amount, 0);

  return {
    totalBeneficiaries: beneficiaries.length,
    totalDevices: items.length,
    devicesByStatus,
    allocationsByStatus,
    totalGivenOut: allocations.length,
    totalReturned,
    givenOutThisMonth,
    returnedThisMonth,
    totalContributionsInr,
  };
}
