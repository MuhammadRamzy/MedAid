"use client";

import Link from "next/link";
import { ArrowLeft, ScrollText } from "lucide-react";
import { useCurrentUser } from "@/components/nav-context";

export default function ActivityLogPage() {
  const { user, loading } = useCurrentUser();

  if (loading) return null;
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

      <div className="flex flex-col items-center justify-center space-y-3 rounded-2xl border-2 border-dashed border-muted p-16 text-center">
        <ScrollText className="h-10 w-10 text-muted-foreground/60" />
        <h2 className="text-lg font-bold text-foreground">Activity Log</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Recording of user activity begins in the next release.
        </p>
      </div>
    </div>
  );
}
