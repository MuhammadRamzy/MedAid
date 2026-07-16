"use client";

import { useState, useEffect, useRef } from "react";
import { Item, Beneficiary } from "@/lib/db-service";
import { createBeneficiaryAction, createAllocationAction } from "@/app/actions";
import { X, Trash2, UserPlus, UserCheck, Calendar, FileText, Loader2, ChevronsRight } from "lucide-react";
import { useRouter } from "next/navigation";

interface SlideToConfirmProps {
  onConfirm: () => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export function SlideToConfirm({ onConfirm, disabled, isLoading }: SlideToConfirmProps) {
  const [sliderPosition, setSliderPosition] = useState(0); // 0 to 100
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const trackWidthRef = useRef(0);
  
  const sliderPositionRef = useRef(0);
  const isDraggingRef = useRef(false);

  // Sync refs
  sliderPositionRef.current = sliderPosition;
  isDraggingRef.current = isDragging;

  const handleStart = (clientX: number) => {
    if (disabled || isLoading) return;
    setIsDragging(true);
    startXRef.current = clientX;
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const handleWidth = 48; // w-12 = 48px
      trackWidthRef.current = rect.width - handleWidth - 8; // padding (4px left, 4px right)
    }
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || trackWidthRef.current <= 0) return;
      const deltaX = e.clientX - startXRef.current;
      let percentage = (deltaX / trackWidthRef.current) * 100;
      if (percentage < 0) percentage = 0;
      if (percentage > 100) percentage = 100;
      setSliderPosition(percentage);
    };

    const handleGlobalMouseUp = () => {
      if (!isDraggingRef.current) return;
      setIsDragging(false);
      if (sliderPositionRef.current >= 90) {
        setSliderPosition(100);
        onConfirm();
      } else {
        setSliderPosition(0);
      }
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current || trackWidthRef.current <= 0 || e.touches.length === 0) return;
      const deltaX = e.touches[0].clientX - startXRef.current;
      let percentage = (deltaX / trackWidthRef.current) * 100;
      if (percentage < 0) percentage = 0;
      if (percentage > 100) percentage = 100;
      setSliderPosition(percentage);
    };

    const handleGlobalTouchEnd = () => {
      if (!isDraggingRef.current) return;
      setIsDragging(false);
      if (sliderPositionRef.current >= 90) {
        setSliderPosition(100);
        onConfirm();
      } else {
        setSliderPosition(0);
      }
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleGlobalMouseMove);
      window.addEventListener("mouseup", handleGlobalMouseUp);
      window.addEventListener("touchmove", handleGlobalTouchMove);
      window.addEventListener("touchend", handleGlobalTouchEnd);
    }

    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
      window.removeEventListener("touchmove", handleGlobalTouchMove);
      window.removeEventListener("touchend", handleGlobalTouchEnd);
    };
  }, [isDragging, onConfirm]);

  // Reset slider position if loading state finishes
  useEffect(() => {
    if (!isLoading) {
      setSliderPosition(0);
    }
  }, [isLoading]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-14 rounded-2xl bg-teal-50/70 border border-teal-100/70 flex items-center justify-center overflow-hidden select-none ${
        disabled ? "opacity-50 pointer-events-none" : ""
      }`}
    >
      <style>{`
        @keyframes bounce-horizontal {
          0%, 100% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(4px);
          }
        }
        .animate-bounce-horizontal {
          animation: bounce-horizontal 1s infinite;
        }
      `}</style>

      {/* Progress track background */}
      <div
        className="absolute left-0 top-0 bottom-0 bg-teal-600/10 transition-all duration-75"
        style={{ width: `${sliderPosition}%` }}
      />

      {/* Track Label */}
      <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-teal-800 animate-pulse z-10 pointer-events-none">
        {isLoading ? "Processing Lease Request..." : "Slide to Confirm Allocation"}
      </span>

      {/* Slider Button Handle */}
      <div
        onMouseDown={(e) => handleStart(e.clientX)}
        onTouchStart={(e) => {
          if (e.touches.length > 0) {
            handleStart(e.touches[0].clientX);
          }
        }}
        className={`absolute left-1 top-1 h-12 w-12 rounded-xl bg-teal-600 text-white flex items-center justify-center cursor-grab active:cursor-grabbing shadow-md z-20 ${
          isDragging ? "" : "transition-transform duration-200"
        }`}
        style={{ transform: `translateX(${(sliderPosition / 100) * trackWidthRef.current}px)` }}
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <ChevronsRight className="h-5 w-5 animate-bounce-horizontal" />
        )}
      </div>
    </div>
  );
}

interface CheckoutCartProps {
  cartItems: Item[];
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  isOpen: boolean;
  onClose: () => void;
  beneficiaries: Beneficiary[];
  onRefreshBeneficiaries: () => void;
}

export function CheckoutCart({
  cartItems,
  onRemoveItem,
  onClearCart,
  isOpen,
  onClose,
  beneficiaries,
  onRefreshBeneficiaries,
}: CheckoutCartProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [beneficiaryMode, setBeneficiaryMode] = useState<"existing" | "new">("existing");
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState<string>("");
  
  // New Beneficiary Form
  const [newBenName, setNewBenName] = useState("");
  const [newBenPhone, setNewBenPhone] = useState("+91");
  const [newBenAddress, setNewBenAddress] = useState("");
  const [newBenVolunteer, setNewBenVolunteer] = useState("");

  // Allocation Form
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [notes, setNotes] = useState("");

  // Set default expected return date to 30 days from now
  useEffect(() => {
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 30);
    const yyyy = defaultDate.getFullYear();
    const mm = String(defaultDate.getMonth() + 1).padStart(2, "0");
    const dd = String(defaultDate.getDate()).padStart(2, "0");
    setExpectedReturnDate(`${yyyy}-${mm}-${dd}`);
  }, []);

  // Pre-fill fields if we have existing beneficiaries
  useEffect(() => {
    if (beneficiaries.length > 0 && !selectedBeneficiaryId) {
      setSelectedBeneficiaryId(beneficiaries[0].id);
    }
  }, [beneficiaries, selectedBeneficiaryId]);

  if (!isOpen) return null;

  const handleCheckout = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (cartItems.length === 0) {
      setError("Please add at least one item to the cart.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let beneficiaryId = selectedBeneficiaryId;

      // 1. Create beneficiary if in "new" mode
      if (beneficiaryMode === "new") {
        if (!newBenName.trim() || !newBenPhone.trim() || !newBenAddress.trim() || !newBenVolunteer.trim()) {
          throw new Error("Please fill in all beneficiary fields.");
        }
        
        const benRes = await createBeneficiaryAction({
          name: newBenName.trim(),
          phone: newBenPhone.trim(),
          address: newBenAddress.trim(),
          volunteerInCharge: newBenVolunteer.trim(),
        });

        if (!benRes.success || !benRes.beneficiary) {
          throw new Error(benRes.error || "Failed to register beneficiary.");
        }

        beneficiaryId = benRes.beneficiary.id;
        onRefreshBeneficiaries();
      }

      if (!beneficiaryId) {
        throw new Error("Please select or create a beneficiary.");
      }

      // 2. Process allocations for all items in the cart
      const allocationIds: string[] = [];
      for (const item of cartItems) {
        const allocRes = await createAllocationAction({
          itemId: item.id,
          beneficiaryId,
          expectedReturnAt: new Date(expectedReturnDate).toISOString(),
          notes: notes.trim(),
        });

        if (!allocRes.success || !allocRes.allocation) {
          throw new Error(allocRes.error || `Failed to allocate ${item.name}`);
        }
        allocationIds.push(allocRes.allocation.id);
      }

      // 3. Success -> Clear Cart, Close, and Redirect to receipt print page
      onClearCart();
      onClose();
      router.push(`/receipt/${allocationIds.join(",")}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
      {/* Overlay click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Cart Drawer Content */}
      <form
        onSubmit={handleCheckout}
        className="relative flex h-full w-full max-w-md flex-col bg-card shadow-2xl animate-slide-up md:animate-none md:rounded-l-2xl border-l border-border"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-bold text-teal-800">Checkout Cart</h2>
            <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-bold text-teal-700">
              {cartItems.length} {cartItems.length === 1 ? "item" : "items"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 pb-24 no-scrollbar">
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3.5 text-sm text-destructive font-medium">
              {error}
            </div>
          )}

          {/* Cart Items List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Selected Equipment</h3>
            {cartItems.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-muted p-6 text-center text-sm text-muted-foreground">
                No items in the cart. Tap equipment cards to add.
              </div>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {cartItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-muted/40 p-3 transition-all hover:bg-muted"
                  >
                    <div>
                      <p className="text-sm font-semibold">{item.name}</p>
                      <span className="text-xs rounded bg-teal-50 px-1.5 py-0.5 font-bold text-teal-700 uppercase tracking-wide border border-teal-100 mt-1 inline-block">
                        {item.assetTag}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.id)}
                      className="text-muted-foreground hover:text-destructive p-1 rounded-lg hover:bg-destructive/5 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Beneficiary Selection Header */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Beneficiary Information</h3>
              <div className="flex rounded-lg border border-border p-0.5 bg-muted">
                <button
                  type="button"
                  onClick={() => setBeneficiaryMode("existing")}
                  className={`flex items-center space-x-1 rounded-md px-2.5 py-1 text-sm font-semibold transition-all ${
                    beneficiaryMode === "existing"
                      ? "bg-card text-teal-800 shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <UserCheck className="h-3 w-3" />
                  <span>Select</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBeneficiaryMode("new")}
                  className={`flex items-center space-x-1 rounded-md px-2.5 py-1 text-sm font-semibold transition-all ${
                    beneficiaryMode === "new"
                      ? "bg-card text-teal-800 shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <UserPlus className="h-3 w-3" />
                  <span>New</span>
                </button>
              </div>
            </div>

            {beneficiaryMode === "existing" ? (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-muted-foreground">Search Beneficiary</label>
                <select
                  value={selectedBeneficiaryId}
                  onChange={(e) => setSelectedBeneficiaryId(e.target.value)}
                  className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="" disabled>Select a beneficiary...</option>
                  {beneficiaries.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.phone})
                    </option>
                  ))}
                </select>
                {beneficiaries.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">No registered beneficiaries. Create a new one!</p>
                )}
              </div>
            ) : (
              <div className="space-y-3 rounded-xl border border-border p-4 bg-muted/20">
                <div className="space-y-1">
                  <label className="text-sm font-bold text-muted-foreground">Full Name</label>
                  <input
                    type="text"
                    required
                    value={newBenName}
                    onChange={(e) => setNewBenName(e.target.value)}
                    placeholder="e.g. Aboobacker Siddique"
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-bold text-muted-foreground">WhatsApp Number</label>
                  <input
                    type="tel"
                    required
                    value={newBenPhone}
                    onChange={(e) => setNewBenPhone(e.target.value)}
                    placeholder="+919847012345"
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-bold text-muted-foreground">Residential Address</label>
                  <textarea
                    required
                    rows={2}
                    value={newBenAddress}
                    onChange={(e) => setNewBenAddress(e.target.value)}
                    placeholder="House details, Local landmarks, City, Pin"
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-bold text-muted-foreground">KMCC Volunteer In Charge</label>
                  <input
                    type="text"
                    required
                    value={newBenVolunteer}
                    onChange={(e) => setNewBenVolunteer(e.target.value)}
                    placeholder="e.g. Faisal P.K."
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Return Date & Notes */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Allocation Terms</h3>
            
            <div className="space-y-1">
              <label className="flex items-center space-x-1.5 text-xs font-semibold text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 text-teal-700" />
                <span>Expected Return Date</span>
              </label>
              <input
                type="date"
                required
                value={expectedReturnDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
                className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="space-y-1">
              <label className="flex items-center space-x-1.5 text-xs font-semibold text-muted-foreground">
                <FileText className="h-3.5 w-3.5 text-teal-700" />
                <span>Allocation Notes / Patient Condition</span>
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Details of surgery, support requirements, or notes..."
                className="w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

        </div>

        {/* Sticky Bottom Actions */}
        <div className="border-t border-border bg-card p-4 flex-shrink-0">
          <SlideToConfirm
            onConfirm={handleCheckout}
            disabled={cartItems.length === 0}
            isLoading={isSubmitting}
          />
        </div>
      </form>
    </div>
  );
}
