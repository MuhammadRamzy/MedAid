"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createItemAction } from "@/app/actions/items";
import type { Condition } from "@/lib/types";
import { useCurrentUser } from "@/components/nav-context";
import { Button } from "@/components/ui/button";
import { PlusCircle, Tag, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AddItemPage() {
  const router = useRouter();
  const { user, loading: loadingSession } = useCurrentUser();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Mobility");
  const [assetTag, setAssetTag] = useState("");
  const [condition, setCondition] = useState<Condition>("New");

  type AcquisitionSource = "purchase" | "donation" | null;
  const [acquisitionSource, setAcquisitionSource] = useState<AcquisitionSource>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [supplier, setSupplier] = useState("");
  const [price, setPrice] = useState("");
  const [sourceOfFund, setSourceOfFund] = useState("");
  const [contributorName, setContributorName] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Disable submit until the form is actually completable, rather than only
  // discovering missing fields after a failed submit attempt.
  const isFormValid =
    name.trim().length > 0 &&
    assetTag.trim().length > 0 &&
    (acquisitionSource === "purchase"
      ? invoiceNumber.trim().length > 0 &&
        supplier.trim().length > 0 &&
        sourceOfFund.trim().length > 0 &&
        Number(price) > 0
      : acquisitionSource === "donation"
        ? contributorName.trim().length > 0
        : false);

  // Suggest a tag based on category
  const handleSuggestTag = () => {
    const prefix = category.substring(0, 3).toUpperCase();
    const randomNum = Math.floor(100 + Math.random() * 900);
    setAssetTag(`KMCC-${prefix}-${randomNum}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !assetTag.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    if (!acquisitionSource) {
      setError("Please choose whether this device was purchased or donated.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const acquisition =
      acquisitionSource === "purchase"
        ? {
            source: "purchase" as const,
            invoiceNumber: invoiceNumber.trim(),
            supplier: supplier.trim(),
            price: Number(price),
            sourceOfFund: sourceOfFund.trim(),
          }
        : {
            source: "donation" as const,
            contributorName: contributorName.trim(),
            estimatedValue: estimatedValue.trim() ? Number(estimatedValue) : null,
          };

    try {
      const res = await createItemAction({
        name: name.trim(),
        category,
        assetTag: assetTag.trim().toUpperCase(),
        condition,
        registeredAt: new Date().toISOString(),
        acquisition,
      });

      if (!res.success) {
        throw new Error(res.error || "Failed to create item.");
      }

      toast.success(
        `${name.trim()} registered`,
        condition === "Needs Repair"
          ? { description: "Held in maintenance until it's fixed." }
          : { description: "Immediately available for lending." }
      );
      setName("");
      setAssetTag("");
      setAcquisitionSource(null);
      setInvoiceNumber("");
      setSupplier("");
      setPrice("");
      setSourceOfFund("");
      setContributorName("");
      setEstimatedValue("");
      // Refresh router so catalog is updated
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingSession) return null;
  if (user?.role !== "admin") {
    return (
      <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        This area is for administrators.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6 animate-page">
      {/* Back button */}
      <Link
        href="/"
        className="inline-flex items-center space-x-2 text-xs font-bold text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back to POS Checkout</span>
      </Link>

      {/* Header */}
      <div>
        <h2 className="text-xl font-extrabold tracking-tight text-teal-900">
          Register Medical Equipment
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Add new wheelchairs, beds, oxygen concentrators, or crutches to the active inventory database.
        </p>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="flex items-start space-x-3 rounded-2xl bg-destructive/10 border border-destructive/20 p-4 text-destructive animate-fade-in shadow-sm">
          <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0 text-destructive-600" />
          <div>
            <h4 className="text-sm font-bold">Registration Failed</h4>
            <p className="text-xs text-destructive-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Form Card */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="Mobility">Mobility (Wheelchairs, Walkers, Crutches)</option>
              <option value="Respiratory">Respiratory (Oxygen Concentrators, Cylinders)</option>
              <option value="Comfort">Comfort (Hospital Beds, Air Mattresses)</option>
              <option value="Orthopedic">Orthopedic (Knee braces, Elbow crutches)</option>
            </select>
          </div>

          {/* Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground">Equipment Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Oxygen Concentrator 5L (Philips)"
              className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Asset Tag */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-muted-foreground">Unique Asset Tag / QR String</label>
              <button
                type="button"
                onClick={handleSuggestTag}
                className="text-[10px] font-bold text-teal-800 hover:text-teal-700 underline"
              >
                Auto-generate tag
              </button>
            </div>
            <div className="relative">
              <Tag className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                required
                value={assetTag}
                onChange={(e) => setAssetTag(e.target.value)}
                placeholder="e.g. KMCC-RES-284"
                className="w-full rounded-xl border border-input bg-card pl-11 pr-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring uppercase"
              />
            </div>
            <p className="text-[10px] text-muted-foreground italic">
              This code represents the QR code / Barcode scanned or stuck on the physical equipment.
            </p>
          </div>

          {/* Initial Condition */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground">Condition</label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as Condition)}
              className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="New">New (Unused)</option>
              <option value="Used">Used (Working, in service before)</option>
              <option value="Needs Repair">Needs Repair (Held back for maintenance)</option>
            </select>
          </div>

          {/* Acquisition Source */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground">How was this device acquired?</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAcquisitionSource("purchase")}
                className={`rounded-xl border px-4 py-3 text-sm font-bold transition-all ${
                  acquisitionSource === "purchase"
                    ? "border-primary bg-teal-50 text-primary shadow-sm"
                    : "border-border bg-card text-muted-foreground hover:border-teal-300"
                }`}
              >
                Purchased
              </button>
              <button
                type="button"
                onClick={() => setAcquisitionSource("donation")}
                className={`rounded-xl border px-4 py-3 text-sm font-bold transition-all ${
                  acquisitionSource === "donation"
                    ? "border-primary bg-teal-50 text-primary shadow-sm"
                    : "border-border bg-card text-muted-foreground hover:border-teal-300"
                }`}
              >
                Donated
              </button>
            </div>
          </div>

          {acquisitionSource === "purchase" && (
            <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">Invoice Number</label>
                <input
                  type="text"
                  required
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="e.g. INV-2026-0142"
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">Supplier</label>
                <input
                  type="text"
                  required
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="e.g. Kerala Medical Supplies"
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">Price (INR)</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g. 12500"
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">Source of Fund</label>
                <input
                  type="text"
                  required
                  value={sourceOfFund}
                  onChange={(e) => setSourceOfFund(e.target.value)}
                  placeholder="e.g. General Fund, Zakat Fund"
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          )}

          {acquisitionSource === "donation" && (
            <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">Contributor Name</label>
                <input
                  type="text"
                  required
                  value={contributorName}
                  onChange={(e) => setContributorName(e.target.value)}
                  placeholder="e.g. Anonymous Donor, or a name"
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">Estimated Value (INR, optional)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={estimatedValue}
                  onChange={(e) => setEstimatedValue(e.target.value)}
                  placeholder="e.g. 8000"
                  className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          )}

          {/* Submit */}
          <Button type="submit" size="lg" disabled={isSubmitting || !isFormValid} className="w-full">
            <PlusCircle />
            <span>{isSubmitting ? "Registering..." : "Register Equipment"}</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
