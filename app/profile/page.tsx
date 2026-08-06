"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Loader2, User, Lock, ShieldCheck } from "lucide-react";
import { useCurrentUser } from "@/components/nav-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getOwnProfileAction, updateOwnProfileAction, changeOwnPinAction } from "@/app/actions/profile";
import type { UserProfile } from "@/lib/types";

export default function ProfilePage() {
  const { user, loading: loadingSession } = useCurrentUser();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isChangingPin, setIsChangingPin] = useState(false);

  const loadProfile = async () => {
    setLoadingProfile(true);
    try {
      const p = await getOwnProfileAction();
      setProfile(p);
      if (p) {
        setName(p.name);
        setMobile(p.mobile ?? "+91");
      }
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  if (loadingSession || (user && loadingProfile)) return null;
  if (!user) {
    return (
      <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Please sign in.
      </p>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const res = await updateOwnProfileAction({ name, mobile });
      if (res.success) {
        toast.success("Profile updated.");
        loadProfile();
      } else {
        toast.error(res.error ?? "Could not update your profile.");
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin !== confirmPin) {
      toast.error("New PIN and confirmation don't match.");
      return;
    }
    setIsChangingPin(true);
    try {
      const res = await changeOwnPinAction({ currentPin, newPin });
      if (res.success) {
        toast.success("PIN changed.");
        setCurrentPin("");
        setNewPin("");
        setConfirmPin("");
      } else {
        toast.error(res.error ?? "Could not change your PIN.");
      }
    } finally {
      setIsChangingPin(false);
    }
  };

  return (
    <div className="animate-page mx-auto max-w-lg space-y-6">
      <Link
        href="/"
        className="inline-flex items-center space-x-2 text-xs font-bold text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back</span>
      </Link>

      <div>
        <h2 className="text-xl font-extrabold tracking-tight text-teal-900 md:text-2xl">My Profile</h2>
        <p className="text-xs text-muted-foreground">Update your details and change your sign-in PIN.</p>
      </div>

      {!profile ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Account summary */}
          <div className="flex items-center space-x-3 rounded-2xl border border-border bg-card p-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-teal-50 text-primary">
              <User className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-foreground">{profile.email}</p>
              <p className="text-[11px] text-muted-foreground">Signed in as</p>
            </div>
            <Badge variant={profile.role === "admin" ? "default" : "neutral"}>
              <ShieldCheck className="mr-1 h-3 w-3" />
              {profile.role === "admin" ? "Administrator" : "Volunteer"}
            </Badge>
          </div>

          {/* Edit name/mobile */}
          <form
            onSubmit={handleSaveProfile}
            className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm"
          >
            <h3 className="flex items-center space-x-2 text-sm font-bold text-foreground">
              <User className="h-4 w-4 text-primary" />
              <span>Your Details</span>
            </h3>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground">Mobile Number</label>
              <input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="+91"
                className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground">Email</label>
              <p className="rounded-xl border border-dashed border-input bg-muted/40 px-3.5 py-2.5 text-sm text-muted-foreground">
                {profile.email}
              </p>
              <p className="text-[10px] text-muted-foreground italic">
                Email can&apos;t be changed here — ask an administrator.
              </p>
            </div>

            <Button type="submit" disabled={isSavingProfile} className="w-full">
              {isSavingProfile ? "Saving…" : "Save Changes"}
            </Button>
          </form>

          {/* Change PIN */}
          <form
            onSubmit={handleChangePin}
            className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm"
          >
            <h3 className="flex items-center space-x-2 text-sm font-bold text-foreground">
              <Lock className="h-4 w-4 text-primary" />
              <span>Change PIN</span>
            </h3>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground">Current PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                required
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">New PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                  className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">Confirm New PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                  className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground italic">
              Your PIN must be exactly 6 digits.
            </p>

            <Button
              type="submit"
              variant="outline"
              disabled={isChangingPin || currentPin.length !== 6 || newPin.length !== 6 || confirmPin.length !== 6}
              className="w-full"
            >
              {isChangingPin ? "Changing…" : "Change PIN"}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
