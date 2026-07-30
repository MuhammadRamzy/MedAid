"use client";

import { signOut } from "firebase/auth";
import { clientAuth } from "@/lib/firebase/client";
import { LogOut } from "lucide-react";
import { useCurrentUser } from "@/components/nav-context";

export function SignOutButton() {
  const { user } = useCurrentUser();

  if (!user) return null;

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    await signOut(clientAuth).catch(() => undefined);
    // Full navigation, not router.replace/refresh — see the matching
    // comment in app/login/page.tsx for why: CurrentUserProvider only
    // fetches once per mount and needs the whole tree to remount.
    window.location.href = "/login";
  };

  return (
    <button
      onClick={handleSignOut}
      className="flex items-center space-x-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">Sign out</span>
    </button>
  );
}
