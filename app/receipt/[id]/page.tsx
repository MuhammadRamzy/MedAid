"use client";

import { useEffect, useState } from "react";
import { Allocation, Item, Beneficiary } from "@/lib/db-service";
import { getAllocationsAction } from "@/app/actions";
import { Printer, ArrowLeft, Loader2, CheckCircle, MessageSquare } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";

export default function ReceiptPage() {
  const params = useParams();
  const rawIdString = params?.id as string;

  const [allocations, setAllocations] = useState<
    (Allocation & { item?: Item; beneficiary?: Beneficiary })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllocations = async () => {
      const ids = rawIdString ? rawIdString.split(",") : [];
      if (ids.length === 0) {
        setError("No allocation IDs provided.");
        setLoading(false);
        return;
      }
      try {
        const allData = await getAllocationsAction();
        const matched = allData.filter((a) => ids.includes(a.id));
        
        if (matched.length === 0) {
          setError("No matching allocation records found.");
        } else {
          setAllocations(matched);
        }
      } catch (err) {
        console.error("Failed to load receipt allocations:", err);
        setError("Failed to load allocation records.");
      } finally {
        setLoading(false);
      }
    };

    fetchAllocations();
  }, [rawIdString]);

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const getWhatsAppUrl = () => {
    if (allocations.length === 0 || !beneficiary) return "#";
    const cleanPhone = beneficiary.phone.replace(/\D/g, "");
    
    const itemsText = allocations.map((a) => `- ${a.item?.name} (Tag: ${a.item?.assetTag})`).join("\n");
    const returnDate = new Date(allocations[0].expectedReturnAt).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
    
    const text = `*KMCC CHARITY MEDICAL HELP WING*
----------------------------------------
*Receipt Number:* ${receiptNumbers}
*Date:* ${dateAllocated.toLocaleDateString("en-IN")}
*Beneficiary Name:* ${beneficiary.name}
*Volunteer In-charge:* ${volunteer}

*Borrowed Equipment:*
${itemsText}

*Expected Return Date:* ${returnDate}

_Priya ${beneficiary.name}, KMCC Medical Help Wing-il ninnu nalkiya upakaranam expected date aagumbol thirichu elpikkan thalcharyappedunnu. Nandi._

Thank you for your cooperation!`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-semibold text-muted-foreground">Generating receipt layout...</p>
      </div>
    );
  }

  if (error || allocations.length === 0) {
    return (
      <div className="mx-auto max-w-md text-center py-10 space-y-4">
        <div className="rounded-full bg-rose-50 p-3 text-rose-600 border border-rose-100 inline-block">
          <ArrowLeft className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-foreground">Receipt Error</h2>
        <p className="text-sm text-muted-foreground">{error || "An unknown error occurred."}</p>
        <Link href="/" className="inline-block rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">
          Go back to POS
        </Link>
      </div>
    );
  }

  // Common details (assuming same beneficiary since they were processed together)
  const beneficiary = allocations[0].beneficiary;
  const dateAllocated = new Date(allocations[0].allocatedAt);
  const receiptNumbers = allocations.map((a) => a.receiptNumber).join(" / ");
  const volunteer = beneficiary?.volunteerInCharge || "KMCC Volunteer";

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-4 print:hidden">
        <Link
          href="/"
          className="flex items-center space-x-2 text-xs font-bold text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>POS Checkout</span>
        </Link>
        <div className="flex space-x-2">
          <a
            href={getWhatsAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-emerald-700 transition-all active:scale-[0.98]"
          >
            <MessageSquare className="h-4 w-4" />
            <span>WhatsApp Receipt</span>
          </a>
          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow hover:bg-primary/95 transition-all active:scale-[0.98]"
          >
            <Printer className="h-4 w-4" />
            <span>Print Receipt</span>
          </button>
        </div>
      </div>

      {/* Screen-only Success Banner (Hidden when printed) */}
      <div className="flex items-start space-x-3 rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-emerald-800 shadow-sm print:hidden animate-fade-in">
        <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0 text-emerald-600" />
        <div>
          <h4 className="text-sm font-bold">Allocation Processed Successfully</h4>
          <p className="text-xs text-emerald-600 mt-0.5">
            Automatic WhatsApp notifications have been generated for {beneficiary?.name}.
          </p>
        </div>
      </div>

      {/* Printable 58mm/80mm Thermal Receipt Layout */}
      <div className="flex justify-center">
        <div className="print-area w-full max-w-[340px] border border-border bg-white p-5 text-black font-mono text-[11px] leading-relaxed shadow-md">
          {/* Header */}
          <div className="text-center space-y-1">
            <div className="relative mx-auto h-12 w-12 overflow-hidden rounded-full mb-1">
              <Image
                src="/logo.png"
                alt="KMCC Logo"
                fill
                sizes="48px"
                className="object-cover grayscale"
              />
            </div>
            <h2 className="text-sm font-black uppercase tracking-tight">K.M.C.C. CHARITY</h2>
            <p className="text-[9px] font-bold uppercase tracking-wider text-neutral-600">
              Medical Help Equipment Wing
            </p>
            <p className="text-[8px] text-neutral-500 leading-normal">
              State Committee Chapter, Kerala, India<br />
              Ph: +91 484 2345678 | Web: kmcccharity.org
            </p>
          </div>

          <div className="my-3 border-b border-dashed border-black/80" />

          {/* Metadata */}
          <div className="space-y-1 text-[10px]">
            <p>
              <span className="font-bold">RECEIPT #:</span> {receiptNumbers}
            </p>
            <p>
              <span className="font-bold">DATE:</span>{" "}
              {dateAllocated.toLocaleString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })}
            </p>
            <p>
              <span className="font-bold">VOLUNTEER:</span> {volunteer}
            </p>
          </div>

          <div className="my-3 border-b border-dashed border-black/80" />

          {/* Beneficiary Info */}
          <div className="space-y-1">
            <h3 className="font-black text-[12px] uppercase">BENEFICIARY</h3>
            <p className="font-bold text-[11px]">{beneficiary?.name}</p>
            <p className="text-[10px]">PH: {beneficiary?.phone}</p>
            <p className="text-[9px] text-neutral-700 leading-normal">
              ADDR: {beneficiary?.address}
            </p>
          </div>

          <div className="my-3 border-b border-dashed border-black/80" />

          {/* Equipment Allocation list */}
          <div className="space-y-3.5">
            <h3 className="font-black text-[12px] uppercase">ALLOCATIONS</h3>
            {allocations.map((alloc, idx) => (
              <div key={alloc.id} className="space-y-1">
                <div className="flex justify-between font-bold">
                  <span>{idx + 1}. {alloc.item?.name}</span>
                </div>
                <div className="flex justify-between text-[10px] text-neutral-600">
                  <span>Tag: {alloc.item?.assetTag}</span>
                  <span>Cond: {alloc.item?.conditionOnCheckIn}</span>
                </div>
                <div className="flex justify-between text-[10px] text-neutral-700">
                  <span>Category: {alloc.item?.category}</span>
                </div>
                <div className="text-[10px] font-bold text-black border-l-2 border-black pl-1.5 py-0.5 mt-1">
                  EXPECTED RETURN:{" "}
                  {new Date(alloc.expectedReturnAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="my-4 border-b border-dashed border-black/80" />

          {/* Terms & Undertaking */}
          <div className="space-y-2 text-[8px] text-neutral-600 leading-normal text-justify">
            <h4 className="font-bold text-[9px] text-black uppercase">UNDERTAKING / TERMS OF LEASE</h4>
            <p>
              1. The medical equipment is lent for charitable reasons and must be used solely for the patient listed.
            </p>
            <p>
              2. I promise to return the equipment in a clean, sanitized, and working condition on or before the expected return date.
            </p>
            <p>
              3. In case of damage or issues, I will inform the KMCC volunteer in charge immediately.
            </p>
          </div>

          <div className="my-6 border-b border-dashed border-black/30" />

          {/* Signatures */}
          <div className="flex justify-between pt-4 text-[9px]">
            <div className="text-center space-y-5">
              <div className="w-16 border-b border-black/80 mx-auto" />
              <span>Beneficiary Sign</span>
            </div>
            <div className="text-center space-y-5">
              <div className="w-16 border-b border-black/80 mx-auto" />
              <span>For KMCC</span>
            </div>
          </div>

          <div className="my-4 border-b border-dashed border-black/80" />

          {/* Footer message */}
          <div className="text-center space-y-0.5 text-[9px]">
            <p className="font-bold">THANK YOU FOR YOUR COOPERATION</p>
            <p className="text-[8px] text-neutral-500">Helping the needy, together.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
