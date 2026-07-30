import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import { statusForCondition } from "@/lib/domain/condition";
import type { Condition, Item } from "@/lib/types";

const items = () => adminDb.collection("items");

function toItem(id: string, data: FirebaseFirestore.DocumentData): Item {
  return {
    id,
    assetTag: data.assetTag,
    name: data.name,
    category: data.category,
    status: data.status,
    condition: data.condition,
    currentAllocationId: data.currentAllocationId ?? null,
  };
}

export async function listItems(): Promise<Item[]> {
  const snapshot = await items().orderBy("assetTag").get();
  return snapshot.docs.map((doc) => toItem(doc.id, doc.data()));
}

export async function getItem(id: string): Promise<Item | null> {
  const doc = await items().doc(id).get();
  return doc.exists ? toItem(doc.id, doc.data()!) : null;
}

export async function assetTagExists(assetTag: string): Promise<boolean> {
  const snapshot = await items()
    .where("assetTagLower", "==", assetTag.toLowerCase())
    .limit(1)
    .get();
  return !snapshot.empty;
}

export interface CreateItemInput {
  assetTag: string;
  name: string;
  category: string;
  condition: Condition;
  registeredAt: string;
  registeredBy: string;
}

export async function createItem(input: CreateItemInput): Promise<Item> {
  const ref = items().doc();
  const record = {
    assetTag: input.assetTag,
    // Stored lowercase alongside the display value because Firestore has no
    // case-insensitive query operator.
    assetTagLower: input.assetTag.toLowerCase(),
    name: input.name,
    category: input.category,
    condition: input.condition,
    status: statusForCondition(input.condition),
    currentAllocationId: null,
    registeredAt: input.registeredAt,
    registeredBy: input.registeredBy,
  };

  await ref.set(record);
  return toItem(ref.id, record);
}

export async function updateItem(
  id: string,
  updates: Partial<Pick<Item, "assetTag" | "name" | "category" | "condition" | "status">>
): Promise<Item | null> {
  const ref = items().doc(id);
  const existing = await ref.get();
  if (!existing.exists) return null;

  const patch: FirebaseFirestore.DocumentData = { ...updates };
  if (updates.assetTag) patch.assetTagLower = updates.assetTag.toLowerCase();

  await ref.update(patch);
  const updated = await ref.get();
  return toItem(updated.id, updated.data()!);
}

export async function deleteItem(id: string): Promise<boolean> {
  const ref = items().doc(id);
  const existing = await ref.get();
  if (!existing.exists) return false;

  const allocations = await adminDb
    .collection("allocations")
    .where("itemId", "==", id)
    .get();

  const batch = adminDb.batch();
  allocations.docs.forEach((doc) => batch.delete(doc.ref));
  batch.delete(ref);
  await batch.commit();

  return true;
}
