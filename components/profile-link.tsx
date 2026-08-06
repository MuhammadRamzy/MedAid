"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User } from "lucide-react";
import { useCurrentUser } from "@/components/nav-context";

export function ProfileLink() {
  const { user } = useCurrentUser();
  const pathname = usePathname();

  if (!user) return null;

  const isActive = pathname === "/profile";

  return (
    <Link
      href="/profile"
      className={`flex items-center space-x-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors hover:bg-muted hover:text-foreground ${
        isActive ? "bg-teal-50 text-primary" : "text-muted-foreground"
      }`}
    >
      <User className="h-4 w-4" />
      <span className="hidden sm:inline">Profile</span>
    </Link>
  );
}
