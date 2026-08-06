"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ScrollText,
  Loader2,
  UserPlus,
  ShieldCheck,
  UserX,
  UserCheck,
  Trash2,
  PlusCircle,
  Edit2,
  HandHeart,
  PackageCheck,
} from "lucide-react";
import { useCurrentUser } from "@/components/nav-context";
import { getActivityAction } from "@/app/actions/activity";
import { labelForAction, type ActivityAction } from "@/lib/domain/activity";
import type { ActivityEntry } from "@/lib/repositories/activity";

const ICONS: Record<ActivityAction, typeof UserPlus> = {
  USER_CREATED: UserPlus,
  USER_ROLE_CHANGED: ShieldCheck,
  USER_DISABLED: UserX,
  USER_ENABLED: UserCheck,
  USER_DELETED: Trash2,
  ITEM_REGISTERED: PlusCircle,
  ITEM_UPDATED: Edit2,
  ITEM_DELETED: Trash2,
  ALLOCATED: HandHeart,
  CHECKED_IN: PackageCheck,
};

const TONES: Record<ActivityAction, string> = {
  USER_CREATED: "bg-emerald-50 text-emerald-700 border-emerald-100",
  USER_ROLE_CHANGED: "bg-teal-50 text-teal-700 border-teal-100",
  USER_DISABLED: "bg-amber-50 text-amber-700 border-amber-100",
  USER_ENABLED: "bg-emerald-50 text-emerald-700 border-emerald-100",
  USER_DELETED: "bg-rose-50 text-rose-700 border-rose-100",
  ITEM_REGISTERED: "bg-emerald-50 text-emerald-700 border-emerald-100",
  ITEM_UPDATED: "bg-blue-50 text-blue-700 border-blue-100",
  ITEM_DELETED: "bg-rose-50 text-rose-700 border-rose-100",
  ALLOCATED: "bg-teal-50 text-teal-700 border-teal-100",
  CHECKED_IN: "bg-blue-50 text-blue-700 border-blue-100",
};

export default function ActivityLogPage() {
  const { user, loading: loadingSession } = useCurrentUser();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== "admin") return;
    getActivityAction()
      .then(setEntries)
      .finally(() => setLoading(false));
  }, [user]);

  if (loadingSession) return null;
  if (user?.role !== "admin") {
    return (
      <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        This area is for administrators.
      </p>
    );
  }

  return (
    <div className="animate-page space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center space-x-2 text-xs font-bold text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back to Admin</span>
      </Link>

      <div>
        <h2 className="text-xl font-extrabold tracking-tight text-teal-900 md:text-2xl">Activity Log</h2>
        <p className="text-xs text-muted-foreground">Who did what, and when — the most recent 100 actions.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center space-y-3 rounded-2xl border-2 border-dashed border-muted p-16 text-center">
          <ScrollText className="h-10 w-10 text-muted-foreground/60" />
          <h3 className="text-lg font-bold text-foreground">No activity yet</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            Every registration, allocation, check-in and account change will show up here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const Icon = ICONS[entry.action];
            return (
              <div
                key={entry.id}
                className="flex items-start space-x-3 rounded-xl border border-border bg-card p-4"
              >
                <span className={`flex-shrink-0 rounded-lg border p-2 ${TONES[entry.action]}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <p className="text-sm font-bold text-foreground">{labelForAction(entry.action)}</p>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(entry.at).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{entry.summary}</p>
                  <p className="mt-1 text-[11px] font-semibold text-teal-700">by {entry.actorName}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
