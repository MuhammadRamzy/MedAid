import { describe, it, expect } from "vitest";
import { computeDashboardStats } from "./dashboard";
import type { Item, AllocationWithRefs, Beneficiary, Contribution } from "@/lib/types";

const NOW = new Date("2026-08-06T12:00:00.000Z");

function item(overrides: Partial<Item>): Item {
  return {
    id: "item-1",
    assetTag: "KMCC-MOB-100",
    name: "Wheelchair",
    category: "Mobility",
    status: "AVAILABLE",
    condition: "Good",
    currentAllocationId: null,
    registeredAt: "2026-01-01T00:00:00.000Z",
    acquisition: { source: "donation", contributorName: "Anon", estimatedValue: 1000 },
    ...overrides,
  };
}

function allocation(overrides: Partial<AllocationWithRefs>): AllocationWithRefs {
  return {
    id: "alloc-1",
    itemId: "item-1",
    beneficiaryId: "ben-1",
    allocatedAt: "2026-08-01T00:00:00.000Z",
    allocatedBy: "uid-1",
    allocatedByName: "Volunteer One",
    expectedReturnAt: "2026-08-15T00:00:00.000Z",
    actualReturnedAt: null,
    checkedInBy: null,
    checkedInByName: null,
    conditionOnReturn: null,
    status: "ACTIVE",
    notes: "",
    receiptNumber: "QID-2026-0001",
    ...overrides,
  };
}

function beneficiary(overrides: Partial<Beneficiary>): Beneficiary {
  return { id: "ben-1", name: "Test Beneficiary", phone: "+911234567890", address: "Kerala", ...overrides };
}

function contribution(overrides: Partial<Contribution>): Contribution {
  return {
    id: "con-1",
    beneficiaryId: "ben-1",
    allocationId: "alloc-1",
    stage: "checkin",
    amount: 500,
    method: "cash",
    reference: "",
    collectedBy: "uid-1",
    collectedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("computeDashboardStats", () => {
  it("counts devices by status", () => {
    const items = [
      item({ id: "1", status: "AVAILABLE" }),
      item({ id: "2", status: "AVAILABLE" }),
      item({ id: "3", status: "ALLOCATED" }),
      item({ id: "4", status: "MAINTENANCE" }),
      item({ id: "5", status: "RETIRED" }),
    ];
    const stats = computeDashboardStats(items, [], [], [], NOW);
    expect(stats.totalDevices).toBe(5);
    expect(stats.devicesByStatus).toEqual({
      AVAILABLE: 2,
      ALLOCATED: 1,
      MAINTENANCE: 1,
      RETIRED: 1,
    });
  });

  it("counts allocations by derived status", () => {
    const allocations = [
      allocation({ id: "a1", status: "ACTIVE" }),
      allocation({ id: "a2", status: "OVERDUE" }),
      allocation({ id: "a3", status: "OVERDUE" }),
      allocation({ id: "a4", status: "RETURNED", actualReturnedAt: "2026-08-05T00:00:00.000Z" }),
    ];
    const stats = computeDashboardStats([], allocations, [], [], NOW);
    expect(stats.allocationsByStatus).toEqual({ ACTIVE: 1, OVERDUE: 2, RETURNED: 1 });
    expect(stats.totalGivenOut).toBe(4);
    expect(stats.totalReturned).toBe(1);
  });

  it("counts beneficiaries", () => {
    const beneficiaries = [beneficiary({ id: "1" }), beneficiary({ id: "2" })];
    const stats = computeDashboardStats([], [], beneficiaries, [], NOW);
    expect(stats.totalBeneficiaries).toBe(2);
  });

  it("only counts give-outs and returns within the current month", () => {
    const allocations = [
      allocation({ id: "in-month", allocatedAt: "2026-08-03T00:00:00.000Z" }),
      allocation({ id: "last-month", allocatedAt: "2026-07-20T00:00:00.000Z" }),
      allocation({
        id: "returned-in-month",
        allocatedAt: "2026-07-01T00:00:00.000Z",
        actualReturnedAt: "2026-08-02T00:00:00.000Z",
        status: "RETURNED",
      }),
      allocation({
        id: "returned-last-month",
        allocatedAt: "2026-06-01T00:00:00.000Z",
        actualReturnedAt: "2026-07-15T00:00:00.000Z",
        status: "RETURNED",
      }),
    ];
    const stats = computeDashboardStats([], allocations, [], [], NOW);
    expect(stats.givenOutThisMonth).toBe(1);
    expect(stats.returnedThisMonth).toBe(1);
  });

  it("sums contribution amounts", () => {
    const contributions = [
      contribution({ id: "c1", amount: 500 }),
      contribution({ id: "c2", amount: 250.5 }),
    ];
    const stats = computeDashboardStats([], [], [], contributions, NOW);
    expect(stats.totalContributionsInr).toBe(750.5);
  });

  it("returns all zeros for empty data", () => {
    const stats = computeDashboardStats([], [], [], [], NOW);
    expect(stats.totalBeneficiaries).toBe(0);
    expect(stats.totalDevices).toBe(0);
    expect(stats.totalGivenOut).toBe(0);
    expect(stats.totalReturned).toBe(0);
    expect(stats.givenOutThisMonth).toBe(0);
    expect(stats.returnedThisMonth).toBe(0);
    expect(stats.totalContributionsInr).toBe(0);
  });
});
