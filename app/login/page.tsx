"use client";

import { useState } from "react";
import Image from "next/image";
import { signInWithEmailAndPassword } from "firebase/auth";
import { clientAuth } from "@/lib/firebase/client";
import { Loader2, LogIn } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const credential = await signInWithEmailAndPassword(clientAuth, email.trim(), password);
      const idToken = await credential.user.getIdToken();

      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Could not sign in.");
      }

      // A full navigation, not router.replace/refresh: CurrentUserProvider
      // lives in the root layout and fetches the signed-in user once on
      // mount. Since that provider never unmounts across a client-side
      // route change, router.refresh() alone leaves it holding the stale
      // (signed-out) state. A hard navigation remounts the whole tree.
      window.location.href = "/";
    } catch (err) {
      // Firebase error codes are not useful to a volunteer.
      const code = (err as { code?: string })?.code;
      if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password" ||
        code === "auth/user-not-found"
      ) {
        setError("That email or password is not correct.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many attempts. Please wait a few minutes and try again.");
      } else if (code === "auth/network-request-failed") {
        setError("No internet connection. Please check and try again.");
      } else {
        setError(err instanceof Error ? err.message : "Could not sign in.");
      }
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-6 rounded-2xl border border-border bg-card p-8 shadow-sm"
      >
        <div className="space-y-3 text-center">
          <div className="relative mx-auto h-16 w-16 overflow-hidden rounded-full border border-primary/20">
            <Image src="/logo.png" alt="QIDMA" fill sizes="64px" priority className="object-cover" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-primary">
              QIDMA Medical Aid
            </h1>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              By KMCC Qatar Vanimal Panchayat
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm font-medium text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-bold text-muted-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-input bg-card px-3.5 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-bold text-muted-foreground">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-input bg-card px-3.5 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center space-x-2 rounded-xl bg-primary py-3.5 font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
          <span>{busy ? "Signing in..." : "Sign In"}</span>
        </button>

        <p className="text-center text-xs text-muted-foreground">
          Accounts are created by an administrator.
        </p>
      </form>
    </div>
  );
}
