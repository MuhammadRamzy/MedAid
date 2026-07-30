"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireUser } from "@/lib/auth/session";
import { messageForAuthError } from "@/lib/auth/errors";
import * as itemsRepo from "@/lib/repositories/items";
import type { Condition, Item } from "@/lib/types";

export async function getItemsAction(): Promise<Item[]> {
  try {
    await requireUser();
    return await itemsRepo.listItems();
  } catch (error) {
    console.error("getItemsAction failed:", error);
    return [];
  }
}

export async function createItemAction(data: {
  assetTag: string;
  name: string;
  category: string;
  condition: Condition;
  registeredAt: string;
}): Promise<{ success: boolean; item?: Item; error?: string }> {
  try {
    const user = await requireAdmin();

    if (await itemsRepo.assetTagExists(data.assetTag)) {
      return { success: false, error: `Asset tag ${data.assetTag} already exists.` };
    }

    const item = await itemsRepo.createItem({ ...data, registeredBy: user.uid });
    revalidatePath("/");
    revalidatePath("/inventory");
    return { success: true, item };
  } catch (error) {
    const authMessage = messageForAuthError(error);
    if (authMessage) return { success: false, error: authMessage };
    console.error("createItemAction failed:", error);
    return { success: false, error: "Could not register the device." };
  }
}

export async function updateItemAction(
  id: string,
  updates: Partial<Pick<Item, "assetTag" | "name" | "category" | "condition" | "status">>
): Promise<{ success: boolean; item?: Item | null; error?: string }> {
  try {
    await requireAdmin();
    const item = await itemsRepo.updateItem(id, updates);
    revalidatePath("/");
    revalidatePath("/inventory");
    return { success: true, item };
  } catch (error) {
    const authMessage = messageForAuthError(error);
    if (authMessage) return { success: false, error: authMessage };
    console.error("updateItemAction failed:", error);
    return { success: false, error: "Could not update the device." };
  }
}

export async function deleteItemAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    const success = await itemsRepo.deleteItem(id);
    revalidatePath("/");
    revalidatePath("/inventory");
    return { success };
  } catch (error) {
    const authMessage = messageForAuthError(error);
    if (authMessage) return { success: false, error: authMessage };
    console.error("deleteItemAction failed:", error);
    return { success: false, error: "Could not delete the device." };
  }
}
