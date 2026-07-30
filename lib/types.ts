import type { Condition, ItemStatus } from "@/lib/domain/condition";
import type { AllocationStatus, DerivedAllocationStatus } from "@/lib/domain/allocation";

export type { Condition, ItemStatus, AllocationStatus, DerivedAllocationStatus };

export type UserRole = "admin" | "volunteer";

export interface Item {
  id: string;
  assetTag: string;
  name: string;
  category: string;
  status: ItemStatus;
  condition: Condition;
  currentAllocationId: string | null;
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
  expectedReturnAt: string;
  actualReturnedAt: string | null;
  checkedInBy: string | null;
  conditionOnReturn: Condition | null;
  status: AllocationStatus;
  notes: string;
  receiptNumber: string;
}

export interface AllocationWithRefs extends Omit<Allocation, "status"> {
  status: DerivedAllocationStatus;
  item?: Item;
  beneficiary?: Beneficiary;
  allocatedByName?: string;
  checkedInByName?: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  mobile: string;
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
