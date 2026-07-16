import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/bottom-nav";
import { PWARegister } from "@/components/pwa-register";
import Link from "next/link";
import Image from "next/image";
import { LayoutGrid, ClipboardList, PlusCircle } from "lucide-react";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "KMCC Medical Equipment POS",
  description: "Charity Inventory & Allocation Management System - Kerala Muslim Cultural Centre",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "KMCC Med POS",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} font-sans`}>
      <head>
        <link rel="icon" href="/logo.png" />
      </head>
      <body className="min-h-screen bg-background pb-16 md:pb-0 text-foreground">
        <PWARegister />

        {/* Global Navigation Header */}
        <header className="sticky top-0 z-40 w-full border-b border-border bg-card/85 backdrop-blur-md px-4 py-3 md:px-8 shadow-sm">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            {/* Branding */}
            <Link href="/" className="flex items-center space-x-3">
              <div className="relative h-10 w-10 overflow-hidden rounded-full border border-primary/20">
                <Image
                  src="/logo.png"
                  alt="KMCC Logo"
                  fill
                  sizes="40px"
                  priority
                  className="object-cover"
                />
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight text-primary md:text-lg">
                  KMCC Charity Wing
                </h1>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Medical Equipment POS
                </p>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden items-center space-x-6 md:flex">
              <Link
                href="/"
                className="flex items-center space-x-2 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors"
              >
                <LayoutGrid className="h-4 w-4" />
                <span>POS Checkout</span>
              </Link>
              <Link
                href="/allocations"
                className="flex items-center space-x-2 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors"
              >
                <ClipboardList className="h-4 w-4" />
                <span>Allocations</span>
              </Link>
              <Link
                href="/add-item"
                className="flex items-center space-x-2 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Add Item</span>
              </Link>
            </nav>
            
            <div className="text-right text-[11px] text-muted-foreground hidden md:block">
              <span className="inline-block px-2.5 py-1 rounded-full bg-teal-50 text-primary font-bold border border-teal-100">
                Kerala Chapter
              </span>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="mx-auto max-w-6xl px-4 py-6 md:px-8">
          {children}
        </main>

        {/* Sticky Mobile Bottom Navigation */}
        <BottomNav />
      </body>
    </html>
  );
}
