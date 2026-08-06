"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, MessageSquare, Plus, ShieldCheck, ShieldOff, Trash2, UserX } from "lucide-react";
import { useCurrentUser } from "@/components/nav-context";
import {
  getUsersAction,
  createUserAction,
  setUserDisabledAction,
  setUserRoleAction,
  deleteUserAction,
} from "@/app/actions/users";
import type { UserProfile, UserRole } from "@/lib/types";

export default function VolunteersPage() {
  const { user, loading: loadingSession } = useCurrentUser();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  // Create form state
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("+91");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("volunteer");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Newly created account, shown once with its PIN
  const [created, setCreated] = useState<{ name: string; mobile: string; email: string; pin: string } | null>(null);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      setUsers(await getUsersAction());
    } catch (err) {
      console.error("Failed to load volunteers:", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (user?.role === "admin") loadUsers();
  }, [user]);

  if (loadingSession) return null;
  if (user?.role !== "admin") {
    return (
      <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        This area is for administrators.
      </p>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await createUserAction({ name: name.trim(), mobile: mobile.trim(), email: email.trim(), role });
      if (!res.success || !res.profile || !res.pin) {
        throw new Error(res.error || "Could not create the account.");
      }

      setCreated({
        name: res.profile.name,
        mobile: res.profile.mobile ?? "",
        email: res.profile.email,
        pin: res.pin,
      });
      setName("");
      setMobile("+91");
      setEmail("");
      setRole("volunteer");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleDisabled = async (u: UserProfile) => {
    const confirmMessage = u.disabled
      ? `Re-enable ${u.name}'s account?`
      : `Disable ${u.name}'s account? They will be signed out immediately.`;
    if (!window.confirm(confirmMessage)) return;

    setBusyUid(u.uid);
    const res = await setUserDisabledAction(u.uid, !u.disabled);
    setBusyUid(null);
    if (!res.success) {
      window.alert(res.error || "Could not update the account.");
      return;
    }
    await loadUsers();
  };

  const handleToggleRole = async (u: UserProfile) => {
    const nextRole: UserRole = u.role === "admin" ? "volunteer" : "admin";
    const confirmMessage =
      nextRole === "admin"
        ? `Make ${u.name} an administrator? They will get full access to devices, volunteers and records.`
        : `Remove ${u.name}'s administrator access? They will be signed out immediately.`;
    if (!window.confirm(confirmMessage)) return;

    setBusyUid(u.uid);
    const res = await setUserRoleAction(u.uid, nextRole);
    setBusyUid(null);
    if (!res.success) {
      window.alert(res.error || "Could not update the account.");
      return;
    }
    await loadUsers();
  };

  const handleDelete = async (u: UserProfile) => {
    const confirmMessage = `Permanently delete ${u.name}'s account? This cannot be undone. Their past activity in the ledger stays on record.`;
    if (!window.confirm(confirmMessage)) return;

    setBusyUid(u.uid);
    const res = await deleteUserAction(u.uid);
    setBusyUid(null);
    if (!res.success) {
      window.alert(res.error || "Could not delete the account.");
      return;
    }
    await loadUsers();
  };

  const shareUrl = created && created.mobile
    ? `https://wa.me/${created.mobile.replace(/\D/g, "")}?text=${encodeURIComponent(
        `QIDMA Medical Aid sign-in\nEmail: ${created.email}\nPIN: ${created.pin}\n\nUse this PIN as your password when you sign in.`
      )}`
    : "#";

  return (
    <div className="animate-page space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center space-x-2 text-xs font-bold text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back to Admin</span>
      </Link>

      <div>
        <h2 className="text-xl font-extrabold tracking-tight text-teal-900 md:text-2xl">Volunteers</h2>
        <p className="text-xs text-muted-foreground">
          Create accounts, promote administrators, and control who has access. People who sign in with Google
          appear here automatically as volunteers the moment they first sign in.
        </p>
      </div>

      {/* Create form */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-4 flex items-center space-x-2 text-sm font-bold text-foreground">
          <Plus className="h-4 w-4 text-primary" />
          <span>Add Volunteer</span>
        </h3>

        {error && (
          <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm font-medium text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <label className="text-xs font-bold text-muted-foreground">WhatsApp Number</label>
            <input
              type="tel"
              required
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="volunteer">Volunteer</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center space-x-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow transition-all hover:bg-primary/95 active:scale-[0.98] disabled:opacity-50 sm:w-auto"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span>{isSubmitting ? "Creating..." : "Create Account"}</span>
            </button>
          </div>
        </form>

        {created && (
          <div className="mt-4 space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
            <p className="text-sm font-bold">Account created for {created.name}</p>
            <p className="text-xs">
              PIN: <span className="font-mono text-base font-bold tracking-widest">{created.pin}</span>
            </p>
            <p className="text-[11px] text-emerald-700">
              Share this PIN with the volunteer — they sign in with their email and this PIN. It will not be shown
              again.
            </p>
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Share via WhatsApp</span>
            </a>
          </div>
        )}
      </div>

      {/* User list */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          All Accounts ({users.length})
        </h3>

        {loadingUsers ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : users.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-muted p-8 text-center text-sm text-muted-foreground">
            No accounts yet.
          </p>
        ) : (
          <div className="space-y-2">
            {users.map((u) => {
              const isSelf = u.uid === user.uid;
              const isBusy = busyUid === u.uid;
              return (
                <div
                  key={u.uid}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${
                    u.disabled ? "border-border bg-muted/30 opacity-70" : "border-border bg-card"
                  }`}
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-bold text-foreground">{u.name}</span>
                      {u.role === "admin" && (
                        <span className="inline-flex items-center space-x-1 rounded-full border border-teal-100 bg-teal-50 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                          <ShieldCheck className="h-3 w-3" />
                          <span>Admin</span>
                        </span>
                      )}
                      {u.disabled && (
                        <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                          Disabled
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {u.email} · {u.mobile ?? "no phone on file"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleToggleRole(u)}
                      disabled={isSelf || isBusy}
                      title={isSelf ? "You cannot change your own role." : undefined}
                      className="flex items-center space-x-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {u.role === "admin" ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                      <span>{u.role === "admin" ? "Remove Admin" : "Make Admin"}</span>
                    </button>
                    <button
                      onClick={() => handleToggleDisabled(u)}
                      disabled={isSelf || isBusy}
                      title={isSelf ? "You cannot disable your own account." : undefined}
                      className="flex items-center space-x-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <UserX className="h-3.5 w-3.5" />
                      <span>{u.disabled ? "Enable" : "Disable"}</span>
                    </button>
                    <button
                      onClick={() => handleDelete(u)}
                      disabled={isSelf || isBusy}
                      title={isSelf ? "You cannot delete your own account." : undefined}
                      className="flex items-center space-x-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
