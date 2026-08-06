import type { Condition, ItemStatus } from "@/lib/domain/condition";
import type { AllocationStatus, DerivedAllocationStatus } from "@/lib/domain/allocation";
import type { Acquisition } from "@/lib/domain/acquisition";
import type { ContributionInput, ContributionMethod, ContributionStage } from "@/lib/domain/contribution";

export type {
  Condition,
  ItemStatus,
  AllocationStatus,
  DerivedAllocationStatus,
  Acquisition,
  ContributionInput,
  ContributionMethod,
  ContributionStage,
};

export type UserRole = "admin" | "volunteer";

export interface Item {
  id: string;
  assetTag: string;
  name: string;
  category: string;
  status: ItemStatus;
  condition: Condition;
  currentAllocationId: string | null;
  registeredAt: string;
  acquisition: Acquisition;
}

export interface Beneficiary {
  id: string;
  name: string;
  phone: string;
  address: string;
}

export interface Allocation {
  id: string;
  itemId: string;
  beneficiaryId: string;
  allocatedAt: string;
  allocatedBy: string;
  // The acting user's display name at the moment of the action, copied in
  // rather than looked up live — so the ledger stays readable after that
  // user's account is deleted, not just disabled.
  allocatedByName: string;
  expectedReturnAt: string;
  actualReturnedAt: string | null;
  checkedInBy: string | null;
  checkedInByName: string | null;
  conditionOnReturn: Condition | null;
  status: AllocationStatus;
  notes: string;
  receiptNumber: string;
}

export interface AllocationWithRefs extends Omit<Allocation, "status"> {
  status: DerivedAllocationStatus;
  item?: Item;
  beneficiary?: Beneficiary;
}

export interface UserProfile {
  uid: string;
  name: string;
  // Google self-signup accounts have no phone number on file; only
  // admin-created accounts are guaranteed one.
  mobile: string | null;
  email: string;
  role: UserRole;
  disabled: boolean;
  createdAt: string;
  createdBy: string;
  lastLoginAt: string | null;
}

export interface SessionUser {
  uid: string;
  email: string;
  role: UserRole;
}

export interface Contribution {
  id: string;
  beneficiaryId: string;
  allocationId: string;
  stage: ContributionStage;
  amount: number;
  method: ContributionMethod;
  reference: string;
  collectedBy: string;
  collectedAt: string;
}
