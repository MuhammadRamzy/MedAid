import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import type { Beneficiary } from "@/lib/types";

const beneficiaries = () => adminDb.collection("beneficiaries");

function toBeneficiary(id: string, data: FirebaseFirestore.DocumentData): Beneficiary {
  return {
    id,
    name: data.name,
    phone: data.phone,
    address: data.address,
  };
}

export async function listBeneficiaries(): Promise<Beneficiary[]> {
  const snapshot = await beneficiaries().orderBy("name").get();
  return snapshot.docs.map((doc) => toBeneficiary(doc.id, doc.data()));
}

export async function getBeneficiary(id: string): Promise<Beneficiary | null> {
  const doc = await beneficiaries().doc(id).get();
  return doc.exists ? toBeneficiary(doc.id, doc.data()!) : null;
}

export interface BeneficiaryInput {
  name: string;
  phone: string;
  address: string;
}

/**
 * Beneficiaries are created inline while lending; there is no registration
 * step. Repeat borrowers are matched on phone number so the ledger does not
 * accumulate duplicates of the same person.
 */
export async function findOrCreateBeneficiary(
  input: BeneficiaryInput,
  createdBy: string
): Promise<Beneficiary> {
  const existing = await beneficiaries().where("phone", "==", input.phone).limit(1).get();
  if (!existing.empty) {
    const doc = existing.docs[0];
    return toBeneficiary(doc.id, doc.data());
  }

  const ref = beneficiaries().doc();
  const record = {
    name: input.name,
    phone: input.phone,
    address: input.address,
    createdAt: new Date().toISOString(),
    createdBy,
  };

  await ref.set(record);
  return toBeneficiary(ref.id, record);
}
