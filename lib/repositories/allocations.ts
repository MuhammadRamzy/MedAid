import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import { deriveStatus } from "@/lib/domain/allocation";
import { formatReceiptNumber, nextSequence } from "@/lib/domain/receipt";
import { statusForCondition } from "@/lib/domain/condition";
import { newContributionRef, buildContributionRecord } from "@/lib/repositories/contributions";
import type {
  Allocation,
  AllocationWithRefs,
  Condition,
  ContributionInput,
  Item,
  Beneficiary,
} from "@/lib/types";

const allocations = () => adminDb.collection("allocations");

function toAllocation(id: string, data: FirebaseFirestore.DocumentData): Allocation {
  return {
    id,
    itemId: data.itemId,
    beneficiaryId: data.beneficiaryId,
    allocatedAt: data.allocatedAt,
    allocatedBy: data.allocatedBy,
    expectedReturnAt: data.expectedReturnAt,
    actualReturnedAt: data.actualReturnedAt ?? null,
    checkedInBy: data.checkedInBy ?? null,
    conditionOnReturn: data.conditionOnReturn ?? null,
    status: data.status,
    notes: data.notes ?? "",
    receiptNumber: data.receiptNumber,
  };
}

/**
 * Loads allocations with their item, beneficiary and acting user names.
 * Reads every collection once and joins in memory rather than issuing a query
 * per row. At committee scale this is the cheaper shape; if the inventory
 * grows into the thousands this needs pagination.
 */
export async function listAllocations(): Promise<AllocationWithRefs[]> {
  const [allocSnap, itemSnap, benSnap, userSnap] = await Promise.all([
    allocations().orderBy("allocatedAt", "desc").get(),
    adminDb.collection("items").get(),
    adminDb.collection("beneficiaries").get(),
    adminDb.collection("users").get(),
  ]);

  const itemsById = new Map<string, Item>(
    itemSnap.docs.map((d) => [
      d.id,
      {
        id: d.id,
        assetTag: d.data().assetTag,
        name: d.data().name,
        category: d.data().category,
        status: d.data().status,
        condition: d.data().condition,
        currentAllocationId: d.data().currentAllocationId ?? null,
        registeredAt: d.data().registeredAt,
        acquisition: d.data().acquisition,
      },
    ])
  );

  const bensById = new Map<string, Beneficiary>(
    benSnap.docs.map((d) => [
      d.id,
      { id: d.id, name: d.data().name, phone: d.data().phone, address: d.data().address },
    ])
  );

  const namesByUid = new Map<string, string>(
    userSnap.docs.map((d) => [d.id, d.data().name as string])
  );

  const now = new Date();

  return allocSnap.docs.map((doc) => {
    const base = toAllocation(doc.id, doc.data());
    return {
      ...base,
      status: deriveStatus(base.status, base.expectedReturnAt, now),
      item: itemsById.get(base.itemId),
      beneficiary: bensById.get(base.beneficiaryId),
      allocatedByName: namesByUid.get(base.allocatedBy),
      checkedInByName: base.checkedInBy ? namesByUid.get(base.checkedInBy) : undefined,
    };
  });
}

export async function getAllocation(id: string): Promise<AllocationWithRefs | null> {
  const doc = await allocations().doc(id).get();
  if (!doc.exists) return null;

  const base = toAllocation(doc.id, doc.data()!);
  const [itemDoc, benDoc] = await Promise.all([
    adminDb.collection("items").doc(base.itemId).get(),
    adminDb.collection("beneficiaries").doc(base.beneficiaryId).get(),
  ]);

  return {
    ...base,
    status: deriveStatus(base.status, base.expectedReturnAt, new Date()),
    item: itemDoc.exists
      ? {
          id: itemDoc.id,
          assetTag: itemDoc.data()!.assetTag,
          name: itemDoc.data()!.name,
          category: itemDoc.data()!.category,
          status: itemDoc.data()!.status,
          condition: itemDoc.data()!.condition,
          currentAllocationId: itemDoc.data()!.currentAllocationId ?? null,
          registeredAt: itemDoc.data()!.registeredAt,
          acquisition: itemDoc.data()!.acquisition,
        }
      : undefined,
    beneficiary: benDoc.exists
      ? {
          id: benDoc.id,
          name: benDoc.data()!.name,
          phone: benDoc.data()!.phone,
          address: benDoc.data()!.address,
        }
      : undefined,
  };
}

export class ItemUnavailableError extends Error {
  constructor(public readonly itemName: string) {
    super(`${itemName} is no longer available.`);
    this.name = "ItemUnavailableError";
  }
}

export interface CreateAllocationInput {
  itemId: string;
  beneficiaryId: string;
  expectedReturnAt: string;
  notes: string;
  allocatedBy: string;
  contribution?: ContributionInput;
}

/**
 * Creating the allocation, flipping the item to ALLOCATED and issuing the
 * receipt number all commit together. Firestore requires every read in a
 * transaction to happen before any write, hence the ordering below. Any
 * beneficiary contribution collected at the same time is written in this
 * same transaction — money collected and the lending record it belongs to
 * either both persist or neither does.
 */
export async function createAllocation(
  input: CreateAllocationInput
): Promise<Allocation> {
  const itemRef = adminDb.collection("items").doc(input.itemId);
  const counterRef = adminDb.collection("counters").doc("receipts");
  const allocRef = allocations().doc();
  const contributionRef = input.contribution ? newContributionRef() : null;

  const record = await adminDb.runTransaction(async (tx) => {
    const itemSnap = await tx.get(itemRef);
    if (!itemSnap.exists) throw new ItemUnavailableError("That device");

    const item = itemSnap.data()!;
    if (item.status !== "AVAILABLE") {
      throw new ItemUnavailableError(item.name as string);
    }

    const counterSnap = await tx.get(counterRef);
    const year = new Date().getFullYear();
    const current = counterSnap.exists
      ? (counterSnap.data() as { year: number; seq: number })
      : null;
    const seq = nextSequence(current, year);

    const allocation = {
      itemId: input.itemId,
      beneficiaryId: input.beneficiaryId,
      allocatedAt: new Date().toISOString(),
      allocatedBy: input.allocatedBy,
      expectedReturnAt: input.expectedReturnAt,
      actualReturnedAt: null,
      checkedInBy: null,
      conditionOnReturn: null,
      status: "ACTIVE" as const,
      notes: input.notes,
      receiptNumber: formatReceiptNumber(year, seq),
    };

    tx.set(counterRef, { year, seq });
    tx.set(allocRef, allocation);
    tx.update(itemRef, { status: "ALLOCATED", currentAllocationId: allocRef.id });

    if (contributionRef && input.contribution) {
      tx.set(
        contributionRef,
        buildContributionRecord({
          ...input.contribution,
          beneficiaryId: input.beneficiaryId,
          allocationId: allocRef.id,
          stage: "checkout",
          collectedBy: input.allocatedBy,
        })
      );
    }

    return allocation;
  });

  return { id: allocRef.id, ...record };
}

export interface ReturnAllocationInput {
  allocationId: string;
  actualReturnedAt: string;
  conditionOnReturn: Condition;
  checkedInBy: string;
}

/** The allocation update and the item's condition-derived status commit together. */
export async function returnAllocation(
  input: ReturnAllocationInput
): Promise<Allocation | null> {
  const allocRef = allocations().doc(input.allocationId);

  return adminDb.runTransaction(async (tx) => {
    const allocSnap = await tx.get(allocRef);
    if (!allocSnap.exists) return null;

    const existing = toAllocation(allocSnap.id, allocSnap.data()!);
    const itemRef = adminDb.collection("items").doc(existing.itemId);
    const itemSnap = await tx.get(itemRef);

    const patch = {
      actualReturnedAt: input.actualReturnedAt,
      checkedInBy: input.checkedInBy,
      conditionOnReturn: input.conditionOnReturn,
      status: "RETURNED" as const,
    };

    tx.update(allocRef, patch);

    if (itemSnap.exists) {
      tx.update(itemRef, {
        status: statusForCondition(input.conditionOnReturn),
        condition: input.conditionOnReturn,
        currentAllocationId: null,
      });
    }

    return { ...existing, ...patch };
  });
}
