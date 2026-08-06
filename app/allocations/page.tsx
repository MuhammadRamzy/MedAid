"use client";

import { useState, useEffect } from "react";
import { AllocationWithRefs, Condition, DerivedAllocationStatus } from "@/lib/types";
import { RETURN_CONDITIONS } from "@/lib/domain/condition";
import { getAllocationsAction, returnAllocationAction } from "@/app/actions/allocations";
import {
  Search,
  Calendar,
  User,
  Phone,
  MapPin,
  Clipboard,
  ArrowLeftRight,
  X,
  Printer,
  ClipboardList,
  MessageSquare,
  HeartHandshake,
  Clock,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default function AllocationsPage() {
  const [allocations, setAllocations] = useState<AllocationWithRefs[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "OVERDUE" | "RETURNED">("ACTIVE");

  // Return Modal State
  const [selectedAlloc, setSelectedAlloc] = useState<AllocationWithRefs | null>(null);
  const [conditionOnReturn, setConditionOnReturn] = useState<Condition>("Good");
  const [actualReturnedAt, setActualReturnedAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check-in contribution (optional, collapsed by default)
  const [showContribution, setShowContribution] = useState(false);
  const [contributionAmount, setContributionAmount] = useState("");
  const [contributionMethod, setContributionMethod] = useState<"cash" | "upi" | "bank_transfer">("cash");
  const [contributionReference, setContributionReference] = useState("");

  const todayIsoDate = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const loadAllocations = async () => {
    try {
      const data = await getAllocationsAction();
      setAllocations(data);
    } catch (err) {
      console.error("Failed to load allocations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllocations();
  }, []);

  // Filter allocations
  const filteredAllocations = allocations.filter((alloc) => {
    const name = alloc.beneficiary?.name || "";
    const phone = alloc.beneficiary?.phone || "";
    const itemName = alloc.item?.name || "";
    const asset = alloc.item?.assetTag || "";
    const receipt = alloc.receiptNumber || "";

    const matchesSearch =
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.toLowerCase().includes(searchQuery.toLowerCase()) ||
      receipt.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE" && alloc.status === "ACTIVE") ||
      (statusFilter === "OVERDUE" && alloc.status === "OVERDUE") ||
      (statusFilter === "RETURNED" && alloc.status === "RETURNED");

    return matchesSearch && matchesStatus;
  });

  const handleOpenReturnModal = (alloc: AllocationWithRefs) => {
    setSelectedAlloc(alloc);
    // A device's condition at registration can be "New" or "Used" — values
    // that aren't offered in this return dropdown (Good/Fair/Needs
    // Repair/Retired). Falling back to those directly would set the select's
    // value to an option that doesn't exist, so the dropdown would visually
    // show "Good" while actually submitting the item's stale registration
    // condition. Only pre-fill from the item's current condition when it's
    // already a valid return condition (e.g. this device has been returned
    // and re-lent before); otherwise default cleanly to "Good".
    const current = alloc.item?.condition;
    setConditionOnReturn(
      current && RETURN_CONDITIONS.includes(current) ? current : "Good"
    );
    setActualReturnedAt(todayIsoDate());
    setShowContribution(false);
    setContributionAmount("");
    setContributionMethod("cash");
    setContributionReference("");
    setError(null);
  };

  const handleCloseReturnModal = () => {
    setSelectedAlloc(null);
  };

  const handleProcessReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlloc) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const contribution =
        showContribution && contributionAmount.trim()
          ? {
              amount: Number(contributionAmount),
              method: contributionMethod,
              reference: contributionReference.trim(),
            }
          : undefined;

      const res = await returnAllocationAction({
        allocationId: selectedAlloc.id,
        conditionOnReturn,
        actualReturnedAt: new Date(actualReturnedAt).toISOString(),
        contribution,
      });

      if (!res.success) {
        throw new Error(res.error || "Failed to process return.");
      }

      await loadAllocations();
      handleCloseReturnModal();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred during return processing.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: DerivedAllocationStatus) => {
    switch (status) {
      case "ACTIVE":
        return (
          <Badge>
            <Clock className="h-3 w-3" />
            <span>Active</span>
          </Badge>
        );
      case "OVERDUE":
        return (
          <Badge variant="destructive" className="animate-pulse">
            <AlertTriangle className="h-3 w-3" />
            <span>Overdue</span>
          </Badge>
        );
      case "RETURNED":
        return (
          <Badge variant="neutral">
            <CheckCircle2 className="h-3 w-3" />
            <span>Returned</span>
          </Badge>
        );
    }
  };

  const getReminderWhatsAppUrl = (alloc: AllocationWithRefs) => {
    if (!alloc.beneficiary || !alloc.item) return "#";
    const cleanPhone = alloc.beneficiary.phone.replace(/\D/g, "");
    
    const returnDate = new Date(alloc.expectedReturnAt).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
    
    let text = "";
    if (alloc.status === "OVERDUE") {
      text = `*QIDMA MEDICAL AID - OVERDUE RETURN REMINDER*
By KMCC Qatar Vanimal Panchayat
--------------------------------------------------
Dear ${alloc.beneficiary.name},

This is a friendly reminder that the *${alloc.item.name}* (Asset Tag: ${alloc.item.assetTag}) you borrowed on ${new Date(alloc.allocatedAt).toLocaleDateString("en-IN")} was expected to be returned by *${returnDate}*.

Please return the equipment to the QIDMA desk at your earliest convenience so it can be serviced and distributed to other patients in need.

If you have any questions, please contact the volunteer in charge: ${alloc.allocatedByName || "our team"}.

Thank you.`;
    } else {
      text = `*QIDMA MEDICAL AID - LEASE STATUS*
By KMCC Qatar Vanimal Panchayat
--------------------------------------------------
Dear ${alloc.beneficiary.name},

This is to confirm that you have an active distribution of *${alloc.item.name}* (Asset Tag: ${alloc.item.assetTag}) since ${new Date(alloc.allocatedAt).toLocaleDateString("en-IN")}.

*Expected Return Date:* ${returnDate}

Please ensure the equipment is returned in clean, sanitised condition by the due date.

For assistance, contact your volunteer in charge: ${alloc.allocatedByName || "our team"}.

Thank you.`;
    }

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm font-semibold text-muted-foreground">Loading allocations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-page">
      {/* Header */}
      <div className="flex flex-col space-y-2 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-teal-900 md:text-2xl">
            Allocation Ledger
          </h2>
          <p className="text-xs text-muted-foreground">
            Track active equipment distributions, overdue status, and register returns.
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by beneficiary name, phone, item, asset tag or receipt..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-input bg-card pl-11 pr-4 py-3 text-sm shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex space-x-1.5 overflow-x-auto pb-1 no-scrollbar">
          {(["ACTIVE", "OVERDUE", "RETURNED", "ALL"] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all border ${
                statusFilter === filter
                  ? "bg-primary border-primary text-primary-foreground shadow"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {filter === "ALL"
                ? "All Records"
                : filter === "ACTIVE"
                ? "Active"
                : filter === "OVERDUE"
                ? "Overdue"
                : "Returned"}
            </button>
          ))}
        </div>
      </div>

      {/* Allocations List */}
      {filteredAllocations.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-muted p-10 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/60 mb-3" />
          <p className="text-sm font-semibold text-muted-foreground">No allocations found.</p>
          <p className="text-xs text-muted-foreground mt-1">Try switching filters or check your search term.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAllocations.map((alloc) => {
            const isReturnable = alloc.status !== "RETURNED";
            const expectedDate = new Date(alloc.expectedReturnAt);
            const isOverdue = alloc.status === "OVERDUE";

            return (
              <div
                key={alloc.id}
                className={`rounded-2xl border bg-card p-5 shadow-sm transition-all hover:shadow-md ${
                  isOverdue ? "border-rose-200 bg-rose-50/5" : "border-border"
                }`}
              >
                {/* Top Section: Header & Status */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                  <div>
                    <span className="text-xs font-bold font-mono text-muted-foreground">
                      {alloc.receiptNumber}
                    </span>
                    <h3 className="text-base font-black text-teal-950 mt-0.5">
                      {alloc.item?.name || "Deleted Item"}
                    </h3>
                    <span className="text-xs rounded bg-teal-50 px-1.5 py-0.5 font-bold text-teal-800 uppercase tracking-wider border border-teal-100 mt-1 inline-block">
                      {alloc.item?.assetTag}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(alloc.status)}
                    {alloc.status !== "RETURNED" && (
                      <a
                        href={getReminderWhatsAppUrl(alloc)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 transition-all border border-emerald-100 bg-emerald-50/30"
                        title="Send WhatsApp Reminder"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </a>
                    )}
                    <Link
                      href={`/receipt/${alloc.id}`}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-primary transition-all border border-border"
                      title="Print Receipt"
                    >
                      <Printer className="h-4 w-4" />
                    </Link>
                  </div>
                </div>

                {/* Details Section */}
                <div className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 md:grid-cols-3">
                  {/* Beneficiary */}
                  <div className="space-y-2">
                    <p className="flex items-center space-x-2 font-bold text-muted-foreground">
                      <User className="h-3.5 w-3.5 text-teal-700" />
                      <span>Beneficiary</span>
                    </p>
                    <div className="pl-5.5 space-y-0.5">
                      <p className="font-extrabold text-foreground">{alloc.beneficiary?.name}</p>
                      <p className="flex items-center space-x-1 text-xs text-muted-foreground font-mono">
                        <Phone className="h-3 w-3" />
                        <span>{alloc.beneficiary?.phone}</span>
                      </p>
                      <p className="flex items-start space-x-1 text-xs text-muted-foreground leading-normal mt-1">
                        <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span>{alloc.beneficiary?.address}</span>
                      </p>
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="space-y-2">
                    <p className="flex items-center space-x-2 font-bold text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5 text-teal-700" />
                      <span>Timeline</span>
                    </p>
                    <div className="pl-5.5 space-y-1 text-xs">
                      <p>
                        <span className="text-muted-foreground">Allocated:</span>{" "}
                        <strong className="text-foreground">
                          {new Date(alloc.allocatedAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </strong>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Expected Return:</span>{" "}
                        <strong className={isOverdue ? "text-rose-600 font-extrabold" : "text-foreground"}>
                          {expectedDate.toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </strong>
                      </p>
                      {alloc.actualReturnedAt && (
                        <p className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5 inline-block mt-1">
                          Returned:{" "}
                          {new Date(alloc.actualReturnedAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Notes & Volunteer */}
                  <div className="space-y-2 sm:col-span-2 md:col-span-1">
                    <p className="flex items-center space-x-2 font-bold text-muted-foreground">
                      <Clipboard className="h-3.5 w-3.5 text-teal-700" />
                      <span>Notes & Management</span>
                    </p>
                    <div className="pl-5.5 space-y-1 text-xs">
                      <p className="italic text-muted-foreground leading-normal">
                        &ldquo;{alloc.notes || "No notes added"}&rdquo;
                      </p>
                      <p className="mt-2 text-muted-foreground">
                        Given out by:{" "}
                        <strong className="text-foreground font-semibold">
                          {alloc.allocatedByName || "—"}
                        </strong>
                      </p>
                      {alloc.checkedInByName && (
                        <p className="text-muted-foreground">
                          Checked in by:{" "}
                          <strong className="text-foreground font-semibold">
                            {alloc.checkedInByName}
                          </strong>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Return Action Button */}
                {isReturnable && (
                  <div className="mt-4 flex justify-end border-t border-border/40 pt-3">
                    <button
                      onClick={() => handleOpenReturnModal(alloc)}
                      className="flex items-center space-x-1.5 rounded-xl bg-teal-50 px-4 py-2.5 text-sm font-bold text-teal-800 border border-teal-200 transition-all hover:bg-teal-100 hover:text-teal-900 active:scale-[0.98]"
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                      <span>Process Check-In (Return)</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Return Modal Overlay */}
      {selectedAlloc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl animate-slide-up border border-border">
            <button
              onClick={handleCloseReturnModal}
              className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-lg font-bold text-teal-950">Process Equipment Return</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Mark equipment as returned and update the system inventory.
            </p>

            <form onSubmit={handleProcessReturn} className="mt-5 space-y-5">
              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive font-medium">
                  {error}
                </div>
              )}

              {/* Item Info */}
              <div className="rounded-xl bg-muted/50 p-3 border border-border">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Equipment</p>
                <p className="text-sm font-bold text-teal-950 mt-0.5">{selectedAlloc.item?.name}</p>
                <p className="text-[10px] font-bold text-muted-foreground font-mono mt-0.5">{selectedAlloc.item?.assetTag}</p>
                
                <div className="mt-2.5 border-t border-border/60 pt-2 flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Borrowed by:</span>
                  <span className="font-bold text-foreground">{selectedAlloc.beneficiary?.name}</span>
                </div>
              </div>

              {/* Actual Return Date */}
              <div className="space-y-2">
                <label className="flex items-center space-x-1.5 text-xs font-bold text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5 text-teal-700" />
                  <span>Actual Return Date</span>
                </label>
                <input
                  type="date"
                  required
                  max={todayIsoDate()}
                  value={actualReturnedAt}
                  onChange={(e) => setActualReturnedAt(e.target.value)}
                  className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="text-[10px] text-muted-foreground italic">
                  Defaults to today — change this if the equipment actually came back earlier.
                </p>
              </div>

              {/* Condition Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">Condition on Check-In</label>
                <select
                  value={conditionOnReturn}
                  onChange={(e) => setConditionOnReturn(e.target.value as Condition)}
                  className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="Good">Good (Working, minor wear)</option>
                  <option value="Fair">Fair (Working, notable wear)</option>
                  <option value="Needs Repair">Needs Repair (Move to Maintenance)</option>
                  <option value="Retired">Retired (Damaged beyond repair)</option>
                </select>
                <p className="text-[10px] text-muted-foreground italic">
                  * Selecting &ldquo;Needs Repair&rdquo; routes the item to maintenance. &ldquo;Retired&rdquo; removes it from active service.
                </p>
              </div>

              {/* Beneficiary Contribution (optional, collapsed by default) */}
              <div className="space-y-2">
                {!showContribution ? (
                  <button
                    type="button"
                    onClick={() => setShowContribution(true)}
                    className="flex items-center space-x-1.5 text-sm font-semibold text-teal-700 hover:text-teal-800"
                  >
                    <HeartHandshake className="h-4 w-4" />
                    <span>Add contribution (optional)</span>
                  </button>
                ) : (
                  <div className="space-y-3 rounded-xl border border-border p-4 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <h3 className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        <HeartHandshake className="h-3.5 w-3.5 text-teal-700" />
                        <span>Beneficiary Contribution</span>
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setShowContribution(false);
                          setContributionAmount("");
                          setContributionReference("");
                        }}
                        className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">Amount (INR)</label>
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        value={contributionAmount}
                        onChange={(e) => setContributionAmount(e.target.value)}
                        placeholder="e.g. 500"
                        className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">Payment Method</label>
                      <select
                        value={contributionMethod}
                        onChange={(e) => setContributionMethod(e.target.value as "cash" | "upi" | "bank_transfer")}
                        className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="cash">Cash</option>
                        <option value="upi">UPI</option>
                        <option value="bank_transfer">Bank Transfer</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground">Reference (optional)</label>
                      <input
                        type="text"
                        value={contributionReference}
                        onChange={(e) => setContributionReference(e.target.value)}
                        placeholder="e.g. UPI transaction ID"
                        className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={handleCloseReturnModal}
                  className="rounded-xl px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center justify-center space-x-1.5 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow transition-all hover:bg-primary/95 disabled:opacity-50"
                >
                  {isSubmitting ? "Updating..." : "Confirm Return"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
