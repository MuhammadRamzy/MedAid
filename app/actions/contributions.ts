"use server";

import { requireUser } from "@/lib/auth/session";
import * as contributionsRepo from "@/lib/repositories/contributions";
import type { Contribution } from "@/lib/types";

export async function getContributionsForAllocationsAction(
  allocationIds: string[]
): Promise<Contribution[]> {
  try {
    await requireUser();
    if (allocationIds.length === 0) return [];
    return await contributionsRepo.listContributionsForAllocations(allocationIds);
  } catch (error) {
    console.error("getContributionsForAllocationsAction failed:", error);
    return [];
  }
}
