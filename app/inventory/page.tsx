"use client";

import { useEffect, useState } from "react";
import { Item } from "@/lib/db-service";
import { getItemsAction, updateItemAction, deleteItemAction } from "@/app/actions";
import {
  Search,
  Wrench,
  CheckCircle2,
  Activity,
  XOctagon,
  X,
  Edit2,
  SlidersHorizontal,
  Plus,
  AlertCircle,
  Trash2
} from "lucide-react";
import Link from "next/link";

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");

  // Edit Modal state
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editName, setEditName] = useState("");
  const [editAssetTag, setEditAssetTag] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editStatus, setEditStatus] = useState<Item["status"]>("AVAILABLE");
  const [editCondition, setEditCondition] = useState("");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState(false);

  const loadItems = async () => {
    setLoading(true);
    try {
      const allItems = await getItemsAction();
      setItems(allItems);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch inventory items.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const handleOpenEditModal = (item: Item) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditAssetTag(item.assetTag);
    setEditCategory(item.category);
    setEditStatus(item.status);
    setEditCondition(item.conditionOnCheckIn);
    setEditError(null);
    setEditSuccess(false);
  };

  const handleCloseEditModal = () => {
    setEditingItem(null);
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setIsSubmitting(true);
    setEditError(null);
    try {
      const result = await updateItemAction(editingItem.id, {
        name: editName,
        assetTag: editAssetTag,
        category: editCategory,
        status: editStatus,
        conditionOnCheckIn: editCondition,
      });

      if (result.success) {
        setEditSuccess(true);
        // Reload items list
        const updatedItems = await getItemsAction();
        setItems(updatedItems);
        setTimeout(() => {
          handleCloseEditModal();
        }, 1200);
      } else {
        setEditError(result.error || "Failed to update item.");
      }
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!editingItem) return;
    
    const confirmMessage = `Are you sure you want to permanently delete "${editingItem.name}" (Tag: ${editingItem.assetTag})?\nThis will remove the item and its lease history. This action cannot be undone.`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsSubmitting(true);
    setEditError(null);
    try {
      const result = await deleteItemAction(editingItem.id);
      if (result.success) {
        setEditSuccess(true);
        const updatedItems = await getItemsAction();
        setItems(updatedItems);
        setTimeout(() => {
          handleCloseEditModal();
        }, 1200);
      } else {
        setEditError(result.error || "Failed to delete item.");
      }
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get distinct categories
  const categoriesList = ["Mobility", "Respiratory", "Comfort", "Orthopedic"];
  const categories = ["All", ...categoriesList];
  const statuses = ["All", "AVAILABLE", "ALLOCATED", "MAINTENANCE", "RETIRED"];

  // Filter items
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.assetTag.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
    const matchesStatus = selectedStatus === "All" || item.status === selectedStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

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
        <p className="text-sm font-semibold text-muted-foreground">Loading Stock Catalog...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Title Header */}
      <div className="flex flex-col space-y-2 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-teal-900 md:text-2xl">
            Inventory & Stock Manager
          </h2>
          <p className="text-xs text-muted-foreground">
            Manage equipment status, document repairs, edit specifications, and retire or delete equipment units.
          </p>
        </div>
        <Link
          href="/add-item"
          className="inline-flex items-center space-x-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow hover:bg-primary/95 transition-all active:scale-[0.98] self-start md:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Register New Stock</span>
        </Link>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive font-medium">
          {error}
        </div>
      )}

      {/* Control Panel: Search & Selectors */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search catalog by name or asset code (e.g. KMCC-MOB-001)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-input bg-background pl-10 pr-4 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Filter selectors */}
        <div className="flex flex-col gap-3 sm:flex-row">
          {/* Category Filter */}
          <div className="flex-1 space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Category</label>
            <div className="flex space-x-1 overflow-x-auto pb-1 no-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all whitespace-nowrap border ${
                    selectedCategory === cat
                      ? "bg-primary border-primary text-primary-foreground shadow-sm"
                      : "bg-background border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex-1 space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</label>
            <div className="flex space-x-1 overflow-x-auto pb-1 no-scrollbar">
              {statuses.map((stat) => (
                <button
                  key={stat}
                  onClick={() => setSelectedStatus(stat)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all whitespace-nowrap border ${
                    selectedStatus === stat
                      ? "bg-primary border-primary text-primary-foreground shadow-sm"
                      : "bg-background border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {stat === "All" ? "All" : stat.charAt(0) + stat.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stock Cards Listing */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Stock Registry ({filteredItems.length} items)
          </h3>
        </div>

        {filteredItems.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-muted p-10 text-center bg-card">
            <SlidersHorizontal className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
            <p className="text-sm font-semibold text-muted-foreground">No stock matching filters found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-border bg-card p-4 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs rounded bg-teal-50 px-2 py-0.5 font-bold text-teal-800 border border-teal-100 uppercase tracking-wider">
                      {item.category}
                    </span>
                    {getStatusBadge(item.status)}
                  </div>
                  <h4 className="mt-3 text-base font-bold text-foreground leading-snug">
                    {item.name}
                  </h4>
                  <p className="mt-1 text-xs font-bold text-muted-foreground font-mono">
                    {item.assetTag}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-xs">
                  <span className="text-muted-foreground">
                    Condition: <strong className="text-foreground">{item.conditionOnCheckIn}</strong>
                  </span>
                  
                  <button
                    onClick={() => handleOpenEditModal(item)}
                    className="flex items-center space-x-1 rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs font-bold text-teal-800 border border-teal-100 transition-all hover:bg-teal-100"
                  >
                    <Edit2 className="h-3 w-3" />
                    <span>Manage</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit/Delete Inventory Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl animate-slide-up border border-border overflow-y-auto max-h-[90vh] no-scrollbar">
            {/* Close */}
            <button
              onClick={handleCloseEditModal}
              className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Modal Title */}
            <div className="mb-4">
              <h3 className="text-lg font-black text-teal-950 flex items-center space-x-2">
                <Edit2 className="h-5 w-5 text-primary" />
                <span>Edit Equipment Registry</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Update stock parameters, operational status, or delete this unit.
              </p>
            </div>

            {/* Success Feedback */}
            {editSuccess ? (
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-center text-sm font-bold text-emerald-800 animate-pulse">
                Inventory successfully updated!
              </div>
            ) : (
              <form onSubmit={handleUpdateItem} className="space-y-4">
                {editError && (
                  <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive font-semibold">
                    {editError}
                  </div>
                )}

                {/* Equipment Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Equipment Model Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="e.g. Standard Wheelchair Heavy Duty"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {/* Asset Tag */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Asset Tag / QR Code
                  </label>
                  <input
                    type="text"
                    required
                    value={editAssetTag}
                    onChange={(e) => setEditAssetTag(e.target.value)}
                    placeholder="e.g. KMCC-MOB-101"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {/* Category Selection */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Category
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {categoriesList.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status selector */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Operational Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as Item["status"])}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="AVAILABLE">AVAILABLE (Ready for Lease)</option>
                    <option value="MAINTENANCE">MAINTENANCE (Needs Cleaning/Repairs)</option>
                    <option value="RETIRED">RETIRED (Disposed/Broken)</option>
                    {editingItem.status === "ALLOCATED" && (
                      <option value="ALLOCATED" disabled>
                        ALLOCATED (Currently Out on Loan)
                      </option>
                    )}
                  </select>
                  {editingItem.status === "ALLOCATED" && (
                    <p className="text-[10px] text-blue-700 flex items-center space-x-1 mt-1 bg-blue-50 p-2 rounded border border-blue-100">
                      <AlertCircle className="h-3 w-3 flex-shrink-0" />
                      <span>This item is currently out with a patient. We recommend changing status only upon check-in return.</span>
                    </p>
                  )}
                </div>

                {/* Condition input */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Condition Description
                  </label>
                  <input
                    type="text"
                    required
                    value={editCondition}
                    onChange={(e) => setEditCondition(e.target.value)}
                    placeholder="e.g. Good, Excellent, Punctured Tire"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {/* Actions: Save / Cancel */}
                <div className="flex space-x-3 border-t border-border/40 pt-4 mt-6">
                  <button
                    type="button"
                    onClick={handleCloseEditModal}
                    className="flex-1 rounded-xl border border-border py-2.5 text-xs font-bold hover:bg-muted transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground shadow hover:bg-primary/95 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {isSubmitting ? "Saving..." : "Save Changes"}
                  </button>
                </div>

                {/* Delete Button (Allowed if not allocated) */}
                <div className="border-t border-border/40 pt-4">
                  {editingItem.status !== "ALLOCATED" ? (
                    <button
                      type="button"
                      onClick={handleDeleteItem}
                      disabled={isSubmitting}
                      className="w-full flex items-center justify-center space-x-1.5 rounded-xl border border-rose-200 bg-rose-50 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Delete Equipment Permanently</span>
                    </button>
                  ) : (
                    <p className="text-[10px] text-muted-foreground text-center bg-slate-50 p-2 rounded border border-slate-100">
                      This item is currently active on loan and cannot be deleted.
                    </p>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
