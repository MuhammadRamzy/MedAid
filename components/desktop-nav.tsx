"use client";

import Link from "next/link";
import { LayoutGrid, ClipboardList, ShieldCheck } from "lucide-react";
import { useCurrentUser } from "@/components/nav-context";

export function DesktopNav() {
  const { user } = useCurrentUser();
  if (!user) return null;

  return (
    <nav className="hidden items-center space-x-6 md:flex">
      <Link
        href="/"
        className="flex items-center space-x-2 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors"
      >
        <LayoutGrid className="h-4 w-4" />
        <span>Give Out</span>
      </Link>
      <Link
        href="/allocations"
        className="flex items-center space-x-2 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors"
      >
        <ClipboardList className="h-4 w-4" />
        <span>Returns</span>
      </Link>
      {user.role === "admin" && (
        <Link
          href="/admin"
          className="flex items-center space-x-2 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors"
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Admin</span>
        </Link>
      )}
    </nav>
  );
}
