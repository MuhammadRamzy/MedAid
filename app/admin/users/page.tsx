"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Loader2, MessageSquare, Plus, ShieldCheck, ShieldOff, Trash2, UserX, UserCheck, Clock } from "lucide-react";
import { useCurrentUser } from "@/components/nav-context";
import { useConfirm } from "@/components/use-confirm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getUsersAction,
  createUserAction,
  setUserDisabledAction,
  setUserRoleAction,
  approveUserAction,
  deleteUserAction,
} from "@/app/actions/users";
import type { UserProfile, UserRole } from "@/lib/types";

export default function VolunteersPage() {
  const { user, loading: loadingSession } = useCurrentUser();
  const { confirm, ConfirmDialog } = useConfirm();

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
      toast.success(`Account created for ${res.profile.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleDisabled = async (u: UserProfile) => {
    const ok = await confirm(
      u.disabled
        ? { title: "Re-enable account?", description: `${u.name} will be able to sign in again.`, confirmLabel: "Re-enable" }
        : {
            title: "Disable account?",
            description: `${u.name} will be signed out immediately and unable to sign back in until re-enabled.`,
            confirmLabel: "Disable",
            variant: "destructive",
          }
    );
    if (!ok) return;

    setBusyUid(u.uid);
    const res = await setUserDisabledAction(u.uid, !u.disabled);
    setBusyUid(null);
    if (!res.success) {
      toast.error(res.error || "Could not update the account.");
      return;
    }
    toast.success(u.disabled ? `${u.name} re-enabled` : `${u.name} disabled`);
    await loadUsers();
  };

  const handleToggleRole = async (u: UserProfile) => {
    const nextRole: UserRole = u.role === "admin" ? "volunteer" : "admin";
    const ok = await confirm(
      nextRole === "admin"
        ? {
            title: "Make this user an administrator?",
            description: `${u.name} will get full access to devices, volunteers and records.`,
            confirmLabel: "Make Admin",
          }
        : {
            title: "Remove administrator access?",
            description: `${u.name} will be signed out immediately and revert to a volunteer account.`,
            confirmLabel: "Remove Admin",
            variant: "destructive",
          }
    );
    if (!ok) return;

    setBusyUid(u.uid);
    const res = await setUserRoleAction(u.uid, nextRole);
    setBusyUid(null);
    if (!res.success) {
      toast.error(res.error || "Could not update the account.");
      return;
    }
    toast.success(`${u.name} is now ${nextRole === "admin" ? "an administrator" : "a volunteer"}`);
    await loadUsers();
  };

  const handleApprove = async (u: UserProfile) => {
    setBusyUid(u.uid);
    const res = await approveUserAction(u.uid);
    setBusyUid(null);
    if (!res.success) {
      toast.error(res.error || "Could not approve the account.");
      return;
    }
    toast.success(`${u.name} approved — they can now sign in`);
    await loadUsers();
  };

  const handleDelete = async (u: UserProfile) => {
    const ok = await confirm({
      title: "Permanently delete this account?",
      description: `This cannot be undone. ${u.name}'s past activity stays on record in the ledger and Activity Log.`,
      confirmLabel: "Delete Account",
      variant: "destructive",
    });
    if (!ok) return;

    setBusyUid(u.uid);
    const res = await deleteUserAction(u.uid);
    setBusyUid(null);
    if (!res.success) {
      toast.error(res.error || "Could not delete the account.");
      return;
    }
    toast.success(`${u.name}'s account was deleted`);
    await loadUsers();
  };

  const pendingUsers = users.filter((u) => !u.approved);
  const approvedUsers = users.filter((u) => u.approved);

  const shareUrl = created && created.mobile
    ? `https://wa.me/${created.mobile.replace(/\D/g, "")}?text=${encodeURIComponent(
        `QIDMA Medical Aid sign-in\nEmail: ${created.email}\nPIN: ${created.pin}\n\nUse this PIN as your password when you sign in.`
      )}`
    : "#";

  return (
    <div className="animate-page space-y-6">
      {ConfirmDialog}

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
          Create accounts, promote administrators, and control who has access. People who sign up
          themselves — with a PIN or with Google — land in Pending Approval below and can&apos;t sign
          in until you approve them.
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
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
              {isSubmitting ? <Loader2 className="animate-spin" /> : <Plus />}
              <span>{isSubmitting ? "Creating..." : "Create Account"}</span>
            </Button>
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

      {loadingUsers ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Pending approval */}
          {pendingUsers.length > 0 && (
            <div className="space-y-3">
              <h3 className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-amber-700">
                <Clock className="h-3.5 w-3.5" />
                <span>Pending Approval ({pendingUsers.length})</span>
              </h3>
              <div className="space-y-2">
                {pendingUsers.map((u) => (
                  <div
                    key={u.uid}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-foreground">{u.name}</span>
                        <Badge variant="warning">
                          <Clock className="h-3 w-3" />
                          <span>Awaiting Approval</span>
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {u.email} · {u.mobile ?? "no phone on file"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" onClick={() => handleApprove(u)} disabled={busyUid === u.uid}>
                        <UserCheck />
                        <span>Approve</span>
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(u)}
                        disabled={busyUid === u.uid}
                      >
                        <Trash2 />
                        <span>Reject</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* User list */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              All Accounts ({approvedUsers.length})
            </h3>

            {approvedUsers.length === 0 ? (
              <p className="rounded-2xl border-2 border-dashed border-muted p-8 text-center text-sm text-muted-foreground">
                No accounts yet.
              </p>
            ) : (
              <div className="space-y-2">
                {approvedUsers.map((u) => {
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
                            <Badge>
                              <ShieldCheck className="h-3 w-3" />
                              <span>Admin</span>
                            </Badge>
                          )}
                          {u.disabled && (
                            <Badge variant="neutral">
                              <UserX className="h-3 w-3" />
                              <span>Disabled</span>
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {u.email} · {u.mobile ?? "no phone on file"}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleRole(u)}
                          disabled={isSelf || isBusy}
                          title={isSelf ? "You cannot change your own role." : undefined}
                        >
                          {u.role === "admin" ? <ShieldOff /> : <ShieldCheck />}
                          <span>{u.role === "admin" ? "Remove Admin" : "Make Admin"}</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleDisabled(u)}
                          disabled={isSelf || isBusy}
                          title={isSelf ? "You cannot disable your own account." : undefined}
                        >
                          <UserX />
                          <span>{u.disabled ? "Enable" : "Disable"}</span>
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(u)}
                          disabled={isSelf || isBusy}
                          title={isSelf ? "You cannot delete your own account." : undefined}
                        >
                          <Trash2 />
                          <span>Delete</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
