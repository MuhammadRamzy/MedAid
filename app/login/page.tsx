"use client";

import { useState } from "react";
import Image from "next/image";
import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { clientAuth, googleProvider } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { Loader2, LogIn, KeyRound } from "lucide-react";

/** Google's "G" mark, inline so the button needs no external asset. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.4C29.7 35.3 27 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.6 5.1C9.6 39.6 16.3 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4.1 5.6l6.6 5.4C41.5 35.9 44 30.4 44 24c0-1.3-.1-2.7-.4-3.5z"
      />
    </svg>
  );
}

/** Every sign-in — PIN or Google — funnels through this before the session cookie is minted. */
async function completeSignIn(getFreshIdToken: () => Promise<string>): Promise<void> {
  const idToken = await getFreshIdToken();

  const provisionRes = await fetch("/api/auth/provision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!provisionRes.ok) {
    const body = await provisionRes.json().catch(() => ({}));
    throw new Error(body.error || "Could not sign in.");
  }

  // The token above was minted before provisioning could have set a role
  // claim (first Google sign-in) — force a refresh so the token actually
  // carries it before it's exchanged for a session cookie.
  const refreshedIdToken = await getFreshIdToken();
  const sessionRes = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: refreshedIdToken }),
  });
  if (!sessionRes.ok) {
    const body = await sessionRes.json().catch(() => ({}));
    throw new Error(body.error || "Could not sign in.");
  }
}

function messageForAuthCode(code: string | undefined): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "That email or PIN is not correct.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "auth/network-request-failed":
      return "No internet connection. Please check and try again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return ""; // user backed out; not an error worth showing
    default:
      return "Could not sign in.";
  }
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"pin" | "google" | null>(null);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("pin");
    setError(null);

    try {
      const credential = await signInWithEmailAndPassword(clientAuth, email.trim(), pin);
      await completeSignIn(() => credential.user.getIdToken(true));
      // Full navigation, not router.replace/refresh: CurrentUserProvider
      // lives in the root layout and fetches the signed-in user once on
      // mount. Since that provider never unmounts across a client-side
      // route change, router.refresh() alone leaves it holding the stale
      // (signed-out) state. A hard navigation remounts the whole tree.
      window.location.href = "/";
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const message = code ? messageForAuthCode(code) : err instanceof Error ? err.message : "Could not sign in.";
      if (message) setError(message);
      setBusy(null);
    }
  };

  const handleGoogleSignIn = async () => {
    setBusy("google");
    setError(null);

    try {
      const credential = await signInWithPopup(clientAuth, googleProvider);
      await completeSignIn(() => credential.user.getIdToken(true));
      window.location.href = "/";
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const message = code ? messageForAuthCode(code) : err instanceof Error ? err.message : "Could not sign in.";
      if (message) setError(message);
      setBusy(null);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-border bg-card p-8 shadow-sm">
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

        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={handleGoogleSignIn}
          disabled={busy !== null}
          className="w-full"
        >
          {busy === "google" ? <Loader2 className="animate-spin" /> : <GoogleMark />}
          <span>{busy === "google" ? "Signing in..." : "Continue with Google"}</span>
        </Button>

        <div className="flex items-center space-x-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handlePinSubmit} className="space-y-4">
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
            <label htmlFor="pin" className="flex items-center space-x-1.5 text-sm font-bold text-muted-foreground">
              <KeyRound className="h-3.5 w-3.5" />
              <span>6-Digit PIN</span>
            </label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              autoComplete="one-time-code"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="••••••"
              className="w-full rounded-xl border border-input bg-card px-3.5 py-3 text-center text-2xl font-bold tracking-[0.6em] focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <Button type="submit" size="lg" disabled={busy !== null || pin.length !== 6} className="w-full">
            {busy === "pin" ? <Loader2 className="animate-spin" /> : <LogIn />}
            <span>{busy === "pin" ? "Signing in..." : "Sign In"}</span>
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          New here? Sign in with Google — an administrator grants access from there.
        </p>
      </div>
    </div>
  );
}
