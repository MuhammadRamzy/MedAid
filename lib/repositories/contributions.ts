import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import type { Contribution, ContributionInput, ContributionStage } from "@/lib/types";

const contributions = () => adminDb.collection("contributions");

function toContribution(id: string, data: FirebaseFirestore.DocumentData): Contribution {
  return {
    id,
    beneficiaryId: data.beneficiaryId,
    allocationId: data.allocationId,
    stage: data.stage,
    amount: data.amount,
    method: data.method,
    reference: data.reference ?? "",
    collectedBy: data.collectedBy,
    collectedAt: data.collectedAt,
  };
}

/** A fresh, unwritten document reference — the caller writes it inside their own transaction. */
export function newContributionRef(): FirebaseFirestore.DocumentReference {
  return contributions().doc();
}

export interface BuildContributionRecordInput extends ContributionInput {
  beneficiaryId: string;
  allocationId: string;
  stage: ContributionStage;
  collectedBy: string;
}

export function buildContributionRecord(input: BuildContributionRecordInput) {
  return {
    beneficiaryId: input.beneficiaryId,
    allocationId: input.allocationId,
    stage: input.stage,
    amount: input.amount,
    method: input.method,
    reference: input.reference,
    collectedBy: input.collectedBy,
    collectedAt: new Date().toISOString(),
  };
}

/**
 * Firestore has no "IN this large list" query beyond 30 values, but a single
 * receipt covers one checkout's worth of items — well under that limit — so
 * a single `in` query is sufficient here.
 */
export async function listContributionsForAllocations(
  allocationIds: string[]
): Promise<Contribution[]> {
  if (allocationIds.length === 0) return [];

  const snapshot = await contributions().where("allocationId", "in", allocationIds).get();
  return snapshot.docs.map((doc) => toContribution(doc.id, doc.data()));
}

/** Every contribution ever recorded — used to total up the dashboard's INR figure. */
export async function listAllContributions(): Promise<Contribution[]> {
  const snapshot = await contributions().get();
  return snapshot.docs.map((doc) => toContribution(doc.id, doc.data()));
}
