"use server";

import { requireAdmin } from "@/lib/auth/session";
import { listRecentActivity, type ActivityEntry } from "@/lib/repositories/activity";

export async function getActivityAction(): Promise<ActivityEntry[]> {
  try {
    await requireAdmin();
    return await listRecentActivity();
  } catch (error) {
    console.error("getActivityAction failed:", error);
    return [];
  }
}
