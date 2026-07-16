"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Item, Beneficiary, Allocation } from "@/lib/db-service";
import { getItemsAction, getBeneficiariesAction, getAllocationsAction } from "@/app/actions";
import { CheckoutCart } from "@/components/checkout-cart";
import { 
  Search, 
  ShoppingCart, 
  Activity, 
  AlertCircle, 
  CheckCircle2, 
  Plus, 
  Check, 
  X,
  Package,
  Wrench,
  XOctagon
} from "lucide-react";

export default function PosDashboard() {
  // DB States
  const [items, setItems] = useState<Item[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [allocations, setAllocations] = useState<(Allocation & { item?: Item; beneficiary?: Beneficiary })[]>([]);
  const [loading, setLoading] = useState(true);

  // Cart State
  const [cart, setCart] = useState<Item[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = ["All", "Mobility", "Respiratory", "Comfort", "Orthopedic"];

  const loadData = async () => {
    try {
      const fetchedItems = await getItemsAction();
      const fetchedBens = await getBeneficiariesAction();
      const fetchedAllocs = await getAllocationsAction();
      setItems(fetchedItems);
      setBeneficiaries(fetchedBens);
      setAllocations(fetchedAllocs);
    } catch (error) {
      console.error("Error loading POS data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setMounted(true);
    setPortalTarget(document.getElementById("header-cart-portal"));
  }, []);

  // Filter items
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.assetTag.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "All" ||
      item.category.toLowerCase() === selectedCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  // Calculate metrics
  const availableItemsCount = items.filter((i) => i.status === "AVAILABLE").length;
  const activeAllocationsCount = allocations.filter((a) => a.status === "ACTIVE").length;
  const overdueReturnsCount = allocations.filter((a) => a.status === "OVERDUE").length;

  const toggleCartItem = (item: Item) => {
    if (item.status !== "AVAILABLE") return;
    
    setCart((prev) => {
      const exists = prev.some((i) => i.id === item.id);
      if (exists) {
        return prev.filter((i) => i.id !== item.id);
      } else {
        return [...prev, item];
      }
    });
  };

  const handleRemoveCartItem = (id: string) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const getStatusBadge = (status: Item["status"]) => {
    switch (status) {
      case "AVAILABLE":
        return (
          <span className="inline-flex items-center space-x-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-100 uppercase tracking-wide">
            <CheckCircle2 className="h-3 w-3" />
            <span>Available</span>
          </span>
        );
      case "ALLOCATED":
        return (
          <span className="inline-flex items-center space-x-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700 border border-blue-100 uppercase tracking-wide">
            <Activity className="h-3 w-3 animate-pulse" />
            <span>Allocated</span>
          </span>
        );
      case "MAINTENANCE":
        return (
          <span className="inline-flex items-center space-x-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 border border-amber-100 uppercase tracking-wide">
            <Wrench className="h-3 w-3" />
            <span>Maintenance</span>
          </span>
        );
      case "RETIRED":
        return (
          <span className="inline-flex items-center space-x-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700 border border-slate-200 uppercase tracking-wide">
            <XOctagon className="h-3 w-3" />
            <span>Retired</span>
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm font-semibold text-muted-foreground">Loading POS System...</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 animate-page">
      {/* Welcome & Live Date */}
      <div className="flex flex-col justify-between space-y-2 md:flex-row md:items-center md:space-y-0">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-teal-900 md:text-2xl">
            POS Allocation Desk
          </h2>
          <p className="text-xs text-muted-foreground">
            Search available equipment and distribute to beneficiaries immediately.
          </p>
        </div>
        <div className="text-xs font-medium text-muted-foreground md:text-right">
          Kerala Muslim Cultural Centre (KMCC) • {new Date().toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-2xl border border-border bg-card p-2.5 sm:p-4 shadow-sm transition-all hover:shadow">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground block truncate">Available</span>
            <span className="rounded-lg bg-emerald-50 p-1 text-emerald-600 border border-emerald-100 hidden sm:inline-flex">
              <Package className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-1 sm:mt-2 text-lg sm:text-2xl font-black text-emerald-800">{availableItemsCount}</p>
          <span className="text-[9px] sm:text-xs text-emerald-600 font-bold block truncate">Items in stock</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-2.5 sm:p-4 shadow-sm transition-all hover:shadow">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground block truncate">Allocated</span>
            <span className="rounded-lg bg-blue-50 p-1 text-blue-600 border border-blue-100 hidden sm:inline-flex">
              <Activity className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-1 sm:mt-2 text-lg sm:text-2xl font-black text-blue-800">{activeAllocationsCount}</p>
          <span className="text-[9px] sm:text-xs text-blue-600 font-bold block truncate">Active ledgers</span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-2.5 sm:p-4 shadow-sm transition-all hover:shadow">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground block truncate">Overdue</span>
            <span className="rounded-lg bg-rose-50 p-1 text-rose-600 border border-rose-100 hidden sm:inline-flex">
              <AlertCircle className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-1 sm:mt-2 text-lg sm:text-2xl font-black text-rose-800">{overdueReturnsCount}</p>
          <span className="text-[9px] sm:text-xs text-rose-600 font-bold block truncate">Needs return</span>
        </div>
      </div>

      {/* POS Controls: Search & Category Buttons */}
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by equipment name or unique asset tag (e.g. KMCC-MOB-001)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-input bg-card pl-11 pr-4 py-3 text-sm shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex space-x-1.5 overflow-x-auto pb-1.5 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition-all whitespace-nowrap border ${
                selectedCategory === cat
                  ? "bg-primary border-primary text-primary-foreground shadow"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Equipment Catalog ({filteredItems.length})
          </h3>
        </div>

        {filteredItems.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-muted p-10 text-center">
            <Package className="mx-auto h-10 w-10 text-muted-foreground/60 mb-3" />
            <p className="text-sm font-semibold text-muted-foreground">No equipment found matching criteria.</p>
            <p className="text-xs text-muted-foreground mt-1">Try clearing your filters or add a new item.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {filteredItems.map((item) => {
              const inCart = cart.some((i) => i.id === item.id);
              const isAvailable = item.status === "AVAILABLE";
              
              return (
                <div
                  key={item.id}
                  onClick={() => isAvailable && toggleCartItem(item)}
                  className={`group relative flex flex-col justify-between rounded-2xl border bg-card p-4 transition-all ${
                    isAvailable
                      ? inCart
                        ? "border-teal-500 ring-2 ring-teal-500/25 bg-teal-50/10 cursor-pointer shadow-md"
                        : "border-border hover:border-teal-300 hover:shadow-md cursor-pointer"
                      : "border-border opacity-70 bg-muted/20 cursor-not-allowed"
                  }`}
                >
                  {/* Card Content */}
                  <div>
                    <div className="flex items-start justify-between">
                      <span className="text-xs rounded bg-teal-50 px-2 py-0.5 font-extrabold text-teal-800 uppercase tracking-wider border border-teal-100">
                        {item.category}
                      </span>
                      {getStatusBadge(item.status)}
                    </div>
                    <h4 className="mt-3.5 text-base font-bold text-foreground leading-snug group-hover:text-primary transition-colors">
                      {item.name}
                    </h4>
                    <p className="mt-1 text-xs font-bold text-muted-foreground font-mono">
                      {item.assetTag}
                    </p>
                  </div>

                  {/* Action/Indicator footer */}
                  <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                    <span className="text-xs text-muted-foreground">
                      Condition: <strong className="text-foreground">{item.conditionOnCheckIn}</strong>
                    </span>

                    {isAvailable && (
                      <div className="flex items-center space-x-1 text-sm font-bold text-primary">
                        {inCart ? (
                          <span className="flex items-center space-x-1 text-teal-600 rounded bg-teal-100 px-2.5 py-1">
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                            <span>Selected</span>
                          </span>
                        ) : (
                          <span className="flex items-center space-x-1 hover:text-teal-700 transition-colors bg-teal-50 text-teal-800 border border-teal-100 rounded px-2.5 py-1">
                            <Plus className="h-3.5 w-3.5 stroke-[3]" />
                            <span>Select</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>

      {mounted && portalTarget && cart.length > 0 && createPortal(
        <button
          onClick={() => setIsCartOpen(true)}
          className="flex items-center space-x-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 px-3 py-1.5 text-xs sm:text-sm font-bold text-white shadow-sm transition-all active:scale-95"
        >
          <ShoppingCart className="h-4 w-4" />
          <span>Cart</span>
          <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-white text-[10px] font-black text-teal-800">
            {cart.length}
          </span>
        </button>,
        portalTarget
      )}

      {mounted && typeof document !== "undefined" && createPortal(
        <CheckoutCart
          cartItems={cart}
          onRemoveItem={handleRemoveCartItem}
          onClearCart={handleClearCart}
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          beneficiaries={beneficiaries}
          onRefreshBeneficiaries={loadData}
        />,
        document.body
      )}
    </>
  );
}
