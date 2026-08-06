"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Boxes,
  PlusCircle,
  Users,
  ScrollText,
  HandHeart,
  PackageCheck,
  AlertTriangle,
  Wrench,
  XOctagon,
  CheckCircle2,
  IndianRupee,
  Loader2,
} from "lucide-react";
import { useCurrentUser } from "@/components/nav-context";
import { getDashboardStatsAction } from "@/app/actions/dashboard";
import type { DashboardStats } from "@/lib/domain/dashboard";

const cards = [
  { href: "/inventory", icon: Boxes, title: "Devices", body: "View and update every registered device." },
  { href: "/add-item", icon: PlusCircle, title: "Register a Device", body: "Add newly purchased or donated equipment." },
  { href: "/admin/users", icon: Users, title: "Volunteers", body: "Create accounts and control who has access." },
  { href: "/admin/activity", icon: ScrollText, title: "Activity Log", body: "See who did what, and when." },
];

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: typeof Boxes;
  label: string;
  value: string | number;
  tone?: "default" | "warning" | "success";
}) {
  const toneClasses = {
    default: "border-teal-100 bg-teal-50 text-primary",
    warning: "border-amber-100 bg-amber-50 text-amber-700",
    success: "border-emerald-100 bg-emerald-50 text-emerald-700",
  }[tone];

  return (
    <div className="flex items-center space-x-3 rounded-2xl border border-border bg-card p-4">
      <span className={`flex-shrink-0 rounded-xl border p-2.5 ${toneClasses}`}>
        <Icon className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0">
        <p className="text-lg font-black leading-tight text-foreground">{value}</p>
        <p className="truncate text-[11px] font-semibold text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function AdminHub() {
  const { user, loading } = useCurrentUser();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (user?.role !== "admin") return;
    getDashboardStatsAction()
      .then(setStats)
      .finally(() => setLoadingStats(false));
  }, [user]);

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
      <div>
        <h2 className="text-xl font-extrabold tracking-tight text-teal-900 md:text-2xl">Admin</h2>
        <p className="text-xs text-muted-foreground">Manage devices, volunteers and records.</p>
      </div>

      {/* Dashboard stats */}
      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Overview
        </h3>
        {loadingStats ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : !stats ? (
          <p className="rounded-2xl border border-dashed border-muted p-6 text-center text-xs text-muted-foreground">
            Could not load dashboard statistics.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard icon={Users} label="Beneficiaries" value={stats.totalBeneficiaries} />
              <StatCard icon={Boxes} label="Total Devices" value={stats.totalDevices} />
              <StatCard
                icon={HandHeart}
                label="Active Loans"
                value={stats.allocationsByStatus.ACTIVE + stats.allocationsByStatus.OVERDUE}
              />
              <StatCard
                icon={AlertTriangle}
                label="Overdue"
                value={stats.allocationsByStatus.OVERDUE}
                tone={stats.allocationsByStatus.OVERDUE > 0 ? "warning" : "default"}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard icon={HandHeart} label="Given Out This Month" value={stats.givenOutThisMonth} />
              <StatCard
                icon={PackageCheck}
                label="Returned This Month"
                value={stats.returnedThisMonth}
                tone="success"
              />
              <StatCard icon={CheckCircle2} label="Total Given Out (All Time)" value={stats.totalGivenOut} />
              <StatCard
                icon={IndianRupee}
                label="Contributions Collected"
                value={`₹${stats.totalContributionsInr.toLocaleString("en-IN")}`}
                tone="success"
              />
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Devices by Status
              </h4>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard icon={CheckCircle2} label="Available" value={stats.devicesByStatus.AVAILABLE} tone="success" />
                <StatCard icon={HandHeart} label="Allocated" value={stats.devicesByStatus.ALLOCATED} />
                <StatCard icon={Wrench} label="Maintenance" value={stats.devicesByStatus.MAINTENANCE} tone="warning" />
                <StatCard icon={XOctagon} label="Retired" value={stats.devicesByStatus.RETIRED} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Manage
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                href={card.href}
                className="flex items-start space-x-4 rounded-2xl border border-border bg-card p-5 transition-all hover:border-teal-300 hover:shadow-md active:scale-[0.99]"
              >
                <span className="rounded-xl border border-teal-100 bg-teal-50 p-2.5 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-base font-bold text-foreground">{card.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{card.body}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
