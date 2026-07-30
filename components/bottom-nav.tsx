"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HandHeart, PackageCheck, ShieldCheck } from "lucide-react";
import { useCurrentUser } from "@/components/nav-context";

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useCurrentUser();

  if (!user || pathname === "/login") return null;

  const navItems = [
    { label: "Give Out", href: "/", icon: HandHeart },
    { label: "Returns", href: "/allocations", icon: PackageCheck },
    ...(user.role === "admin"
      ? [{ label: "Admin", href: "/admin", icon: ShieldCheck }]
      : []),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t border-border bg-card/90 px-6 py-2 shadow-lg backdrop-blur-md md:hidden">
      <div className="flex h-full items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center rounded-xl px-4 py-1.5 transition-all duration-200 active:scale-95 ${
                isActive
                  ? "border border-teal-100/50 bg-teal-50 font-bold text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`h-5 w-5 transition-transform ${isActive ? "scale-110" : ""}`} />
              <span className="mt-0.5 text-[10px] font-bold tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
