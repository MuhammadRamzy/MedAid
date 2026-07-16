"use server";

import { dbService, Item, Beneficiary, Allocation } from "@/lib/db-service";
import { revalidatePath } from "next/cache";

// --- ITEMS ---
export async function getItemsAction(): Promise<Item[]> {
  try {
    return await dbService.getItems();
  } catch (error) {
    console.error("Failed in getItemsAction:", error);
    return [];
  }
}

export async function createItemAction(
  data: Omit<Item, "id" | "currentAllocationId">
): Promise<{ success: boolean; item?: Item; error?: string }> {
  try {
    // Check if asset tag already exists
    const items = await dbService.getItems();
    const exists = items.some(
      (item) => item.assetTag.toLowerCase() === data.assetTag.toLowerCase()
    );
    if (exists) {
      return { success: false, error: `Asset tag ${data.assetTag} already exists.` };
    }

    const item = await dbService.createItem({
      ...data,
      currentAllocationId: null,
    });
    revalidatePath("/");
    return { success: true, item };
  } catch (error) {
    console.error("Failed in createItemAction:", error);
    return { success: false, error: "Failed to create inventory item." };
  }
}

// --- BENEFICIARIES ---
export async function getBeneficiariesAction(): Promise<Beneficiary[]> {
  try {
    return await dbService.getBeneficiaries();
  } catch (error) {
    console.error("Failed in getBeneficiariesAction:", error);
    return [];
  }
}

export async function createBeneficiaryAction(
  data: Omit<Beneficiary, "id">
): Promise<{ success: boolean; beneficiary?: Beneficiary; error?: string }> {
  try {
    if (!data.name || !data.phone || !data.address || !data.volunteerInCharge) {
      return { success: false, error: "All fields are required." };
    }
    const beneficiary = await dbService.createBeneficiary(data);
    revalidatePath("/");
    return { success: true, beneficiary };
  } catch (error) {
    console.error("Failed in createBeneficiaryAction:", error);
    return { success: false, error: "Failed to create beneficiary." };
  }
}

// --- ALLOCATIONS ---
export async function getAllocationsAction(): Promise<
  (Allocation & { item?: Item; beneficiary?: Beneficiary })[]
> {
  try {
    return await dbService.getAllocations();
  } catch (error) {
    console.error("Failed in getAllocationsAction:", error);
    return [];
  }
}

export async function createAllocationAction(data: {
  itemId: string;
  beneficiaryId: string;
  expectedReturnAt: string;
  notes: string;
}): Promise<{ success: boolean; allocation?: Allocation; error?: string }> {
  try {
    const item = await dbService.getItemById(data.itemId);
    if (!item) {
      return { success: false, error: "Item not found." };
    }
    if (item.status !== "AVAILABLE") {
      return { success: false, error: "Item is not available for allocation." };
    }

    const beneficiary = await dbService.getBeneficiaryById(data.beneficiaryId);
    if (!beneficiary) {
      return { success: false, error: "Beneficiary not found." };
    }

    const allocation = await dbService.createAllocation({
      itemId: data.itemId,
      beneficiaryId: data.beneficiaryId,
      allocatedAt: new Date().toISOString(),
      expectedReturnAt: new Date(data.expectedReturnAt).toISOString(),
      notes: data.notes,
    });

    // Send WhatsApp notification asynchronously (simulated)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      // We trigger the notification api route
      await fetch(`${baseUrl}/api/notifications/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "ALLOCATION_SUCCESS",
          beneficiaryName: beneficiary.name,
          beneficiaryPhone: beneficiary.phone,
          itemName: item.name,
          assetTag: item.assetTag,
          expectedReturnAt: allocation.expectedReturnAt,
          volunteerInCharge: beneficiary.volunteerInCharge,
        }),
      });
    } catch (apiErr) {
      console.warn("WhatsApp notification call failed (this is fine for local simulation):", apiErr);
    }

    revalidatePath("/");
    revalidatePath("/allocations");
    return { success: true, allocation };
  } catch (error) {
    console.error("Failed in createAllocationAction:", error);
    return { success: false, error: "Failed to create allocation." };
  }
}

export async function returnAllocationAction(data: {
  allocationId: string;
  conditionOnCheckIn: string;
}): Promise<{ success: boolean; allocation?: Allocation; error?: string }> {
  try {
    const alloc = await dbService.getAllocationById(data.allocationId);
    if (!alloc) {
      return { success: false, error: "Allocation not found." };
    }

    const returnedAlloc = await dbService.returnAllocation(
      data.allocationId,
      new Date().toISOString(),
      data.conditionOnCheckIn
    );

    if (!returnedAlloc) {
      return { success: false, error: "Failed to return allocation." };
    }

    // Send WhatsApp return confirmation (simulated)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      await fetch(`${baseUrl}/api/notifications/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "RETURN_CONFIRMATION",
          beneficiaryName: alloc.beneficiary?.name || "Beneficiary",
          beneficiaryPhone: alloc.beneficiary?.phone || "",
          itemName: alloc.item?.name || "Equipment",
          assetTag: alloc.item?.assetTag || "",
          conditionOnCheckIn: data.conditionOnCheckIn,
          volunteerInCharge: alloc.beneficiary?.volunteerInCharge || "",
        }),
      });
    } catch (apiErr) {
      console.warn("WhatsApp notification call failed (this is fine for local simulation):", apiErr);
    }

    revalidatePath("/");
    revalidatePath("/allocations");
    return { success: true, allocation: returnedAlloc };
  } catch (error) {
    console.error("Failed in returnAllocationAction:", error);
    return { success: false, error: "Failed to process equipment return." };
  }
}
