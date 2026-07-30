import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/bottom-nav";
import { DesktopNav } from "@/components/desktop-nav";
import { PWARegister } from "@/components/pwa-register";
import { CurrentUserProvider } from "@/components/nav-context";
import { SignOutButton } from "@/components/sign-out-button";
import Link from "next/link";
import Image from "next/image";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "QIDMA Medical Aid",
  description: "Medical equipment lending and inventory — By KMCC Qatar Vanimal Panchayat",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "QIDMA",
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
        <CurrentUserProvider>
          <PWARegister />

          {/* Global Navigation Header */}
          <header className="sticky top-0 z-40 w-full border-b border-border bg-card/85 backdrop-blur-md px-4 py-3 md:px-8 shadow-sm">
            <div className="mx-auto flex max-w-6xl items-center justify-between">
              {/* Branding */}
              <Link href="/" className="flex items-center space-x-3">
                <div className="relative h-10 w-10 overflow-hidden rounded-full border border-primary/20">
                  <Image
                    src="/logo.png"
                    alt="QIDMA Medical Aid"
                    fill
                    sizes="40px"
                    priority
                    className="object-cover"
                  />
                </div>
                <div>
                  <h1 className="text-base font-bold tracking-tight text-primary md:text-lg">
                    QIDMA Medical Aid
                  </h1>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    By KMCC Qatar Vanimal Panchayat
                  </p>
                </div>
              </Link>

              {/* Portal target for mobile header checkout cart */}
              <div id="header-cart-portal" className="flex items-center z-50" />

              <DesktopNav />

              <div className="flex items-center space-x-3">
                <span className="hidden md:inline-block rounded-full border border-teal-100 bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-primary">
                  Kerala Chapter
                </span>
                <SignOutButton />
              </div>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="mx-auto max-w-6xl px-4 py-6 md:px-8">
            {children}
          </main>

          {/* Sticky Mobile Bottom Navigation */}
          <BottomNav />
        </CurrentUserProvider>
      </body>
    </html>
  );
}
