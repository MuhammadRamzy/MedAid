"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, ClipboardList, PlusCircle, Wrench } from "lucide-react";

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    {
      label: "POS Checkout",
      href: "/",
      icon: LayoutGrid,
    },
    {
      label: "Allocations",
      href: "/allocations",
      icon: ClipboardList,
    },
    {
      label: "Stock Manager",
      href: "/inventory",
      icon: Wrench,
    },
    {
      label: "Add Item",
      href: "/add-item",
      icon: PlusCircle,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t border-border bg-card/90 backdrop-blur-md px-6 py-2 shadow-lg md:hidden">
      <div className="flex h-full items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center space-y-1 transition-colors ${
                isActive
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
