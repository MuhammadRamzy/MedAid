"use client";

import Link from "next/link";
import { Boxes, PlusCircle, Users, ScrollText } from "lucide-react";
import { useCurrentUser } from "@/components/nav-context";

const cards = [
  { href: "/inventory", icon: Boxes, title: "Devices", body: "View and update every registered device." },
  { href: "/add-item", icon: PlusCircle, title: "Register a Device", body: "Add newly purchased or donated equipment." },
  { href: "/admin/users", icon: Users, title: "Volunteers", body: "Create accounts and control who has access." },
  { href: "/admin/activity", icon: ScrollText, title: "Activity Log", body: "See who did what, and when." },
];

export default function AdminHub() {
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
      <div>
        <h2 className="text-xl font-extrabold tracking-tight text-teal-900 md:text-2xl">Admin</h2>
        <p className="text-xs text-muted-foreground">Manage devices, volunteers and records.</p>
      </div>

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
  );
}
