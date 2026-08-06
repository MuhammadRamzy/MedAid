import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import type { ActivityAction, ActivityTargetType } from "@/lib/domain/activity";

export interface ActivityEntry {
  id: string;
  at: string;
  actorUid: string;
  actorName: string;
  action: ActivityAction;
  targetType: ActivityTargetType;
  targetId: string;
  summary: string;
}

const activityLog = () => adminDb.collection("activityLog");

export interface LogActivityInput {
  actorUid: string;
  actorName: string;
  action: ActivityAction;
  targetType: ActivityTargetType;
  targetId: string;
  summary: string;
}

/**
 * Append-only. The actor's name is copied in rather than looked up live —
 * same reasoning as Allocation.allocatedByName — so the log stays readable
 * after that account is deleted. Never throws: a logging failure must not
 * fail the operation it's describing, so callers fire this and move on.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    await activityLog().add({ ...input, at: new Date().toISOString() });
  } catch (error) {
    console.error("logActivity failed:", error);
  }
}

export async function listRecentActivity(limit = 100): Promise<ActivityEntry[]> {
  const snapshot = await activityLog().orderBy("at", "desc").limit(limit).get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      at: data.at,
      actorUid: data.actorUid,
      actorName: data.actorName,
      action: data.action,
      targetType: data.targetType,
      targetId: data.targetId,
      summary: data.summary,
    };
  });
}
