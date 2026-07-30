"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { messageForAuthError } from "@/lib/auth/errors";
import { validateContribution } from "@/lib/domain/contribution";
import * as allocationsRepo from "@/lib/repositories/allocations";
import { ItemUnavailableError } from "@/lib/repositories/allocations";
import * as beneficiariesRepo from "@/lib/repositories/beneficiaries";
import type { Allocation, AllocationWithRefs, Beneficiary, Condition, ContributionInput } from "@/lib/types";

export async function getAllocationsAction(): Promise<AllocationWithRefs[]> {
  try {
    await requireUser();
    return await allocationsRepo.listAllocations();
  } catch (error) {
    console.error("getAllocationsAction failed:", error);
    return [];
  }
}

export async function getBeneficiariesAction(): Promise<Beneficiary[]> {
  try {
    await requireUser();
    return await beneficiariesRepo.listBeneficiaries();
  } catch (error) {
    console.error("getBeneficiariesAction failed:", error);
    return [];
  }
}

export async function createAllocationAction(data: {
  itemId: string;
  beneficiary: { id?: string; name: string; phone: string; address: string };
  expectedReturnAt: string;
  notes: string;
  contribution?: unknown;
}): Promise<{ success: boolean; allocation?: Allocation; error?: string }> {
  try {
    const user = await requireUser();

    const beneficiary = data.beneficiary.id
      ? await beneficiariesRepo.getBeneficiary(data.beneficiary.id)
      : await beneficiariesRepo.findOrCreateBeneficiary(
          {
            name: data.beneficiary.name,
            phone: data.beneficiary.phone,
            address: data.beneficiary.address,
          },
          user.uid
        );

    if (!beneficiary) return { success: false, error: "Beneficiary not found." };

    let contribution: ContributionInput | undefined;
    if (data.contribution) {
      const result = validateContribution(data.contribution);
      if (!result.valid) return { success: false, error: result.error };
      contribution = result.contribution;
    }

    const allocation = await allocationsRepo.createAllocation({
      itemId: data.itemId,
      beneficiaryId: beneficiary.id,
      expectedReturnAt: new Date(data.expectedReturnAt).toISOString(),
      notes: data.notes,
      allocatedBy: user.uid,
      contribution,
    });

    revalidatePath("/");
    revalidatePath("/allocations");
    return { success: true, allocation };
  } catch (error) {
    const authMessage = messageForAuthError(error);
    if (authMessage) return { success: false, error: authMessage };
    if (error instanceof ItemUnavailableError) {
      return { success: false, error: error.message };
    }
    console.error("createAllocationAction failed:", error);
    return { success: false, error: "Could not give out the equipment." };
  }
}

export async function returnAllocationAction(data: {
  allocationId: string;
  conditionOnReturn: Condition;
  actualReturnedAt: string;
}): Promise<{ success: boolean; allocation?: Allocation; error?: string }> {
  try {
    const user = await requireUser();

    const allocation = await allocationsRepo.returnAllocation({
      allocationId: data.allocationId,
      actualReturnedAt: new Date(data.actualReturnedAt).toISOString(),
      conditionOnReturn: data.conditionOnReturn,
      checkedInBy: user.uid,
    });

    if (!allocation) return { success: false, error: "Allocation not found." };

    revalidatePath("/");
    revalidatePath("/allocations");
    return { success: true, allocation };
  } catch (error) {
    const authMessage = messageForAuthError(error);
    if (authMessage) return { success: false, error: authMessage };
    console.error("returnAllocationAction failed:", error);
    return { success: false, error: "Could not record the return." };
  }
}
