"use client";

import { useState } from "react";
import { createItemAction } from "@/app/actions";
import { PlusCircle, Tag, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AddItemPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Mobility");
  const [assetTag, setAssetTag] = useState("");
  const [conditionOnCheckIn, setConditionOnCheckIn] = useState("Good");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await createItemAction({
        name: name.trim(),
        category,
        assetTag: assetTag.trim().toUpperCase(),
        conditionOnCheckIn,
        status: "AVAILABLE",
      });

      if (!res.success) {
        throw new Error(res.error || "Failed to create item.");
      }

      setSuccess(true);
      setName("");
      setAssetTag("");
      // Refresh router so catalog is updated
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
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
      {success && (
        <div className="flex items-start space-x-3 rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-emerald-800 animate-fade-in shadow-sm">
          <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0 text-emerald-600" />
          <div>
            <h4 className="text-sm font-bold">Equipment Registered Successfully</h4>
            <p className="text-xs text-emerald-600 mt-0.5">
              The item has been added to the catalog and is immediately available for allocation.
            </p>
          </div>
        </div>
      )}

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
              value={conditionOnCheckIn}
              onChange={(e) => setConditionOnCheckIn(e.target.value)}
              className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="Excellent">Excellent (New / Barely Used)</option>
              <option value="Good">Good (Working, minor signs of wear)</option>
              <option value="Fair">Fair (Working, notable wear/aging)</option>
              <option value="Needs Repair">Needs Repair (Needs maintenance before lease)</option>
            </select>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center space-x-1.5 rounded-xl bg-primary px-5 py-3.5 text-sm font-bold text-primary-foreground shadow transition-all hover:bg-primary/95 active:scale-[0.98] disabled:opacity-50"
          >
            <PlusCircle className="h-4 w-4" />
            <span>{isSubmitting ? "Registering..." : "Register Equipment"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
