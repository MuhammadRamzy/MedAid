"use server";

import { requireAdmin } from "@/lib/auth/session";
import { computeDashboardStats, type DashboardStats } from "@/lib/domain/dashboard";
import * as itemsRepo from "@/lib/repositories/items";
import * as allocationsRepo from "@/lib/repositories/allocations";
import * as beneficiariesRepo from "@/lib/repositories/beneficiaries";
import * as contributionsRepo from "@/lib/repositories/contributions";

export async function getDashboardStatsAction(): Promise<DashboardStats | null> {
  try {
    await requireAdmin();

    const [items, allocations, beneficiaries, contributions] = await Promise.all([
      itemsRepo.listItems(),
      allocationsRepo.listAllocations(),
      beneficiariesRepo.listBeneficiaries(),
      contributionsRepo.listAllContributions(),
    ]);

    return computeDashboardStats(items, allocations, beneficiaries, contributions);
  } catch (error) {
    console.error("getDashboardStatsAction failed:", error);
    return null;
  }
}
