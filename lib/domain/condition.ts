export type Condition =
  | "New"
  | "Used"
  | "Good"
  | "Fair"
  | "Needs Repair"
  | "Retired";

export type ItemStatus = "AVAILABLE" | "ALLOCATED" | "MAINTENANCE" | "RETIRED";

/** Conditions offered when registering a device. */
export const REGISTRATION_CONDITIONS: Condition[] = ["New", "Used", "Needs Repair"];

/** Conditions offered when a device is returned. */
export const RETURN_CONDITIONS: Condition[] = ["Good", "Fair", "Needs Repair", "Retired"];

/**
 * A device's condition determines its status, at registration and at return
 * alike. A device recorded as needing repair is never offered for lending.
 */
export function statusForCondition(condition: Condition): ItemStatus {
  switch (condition) {
    case "Needs Repair":
      return "MAINTENANCE";
    case "Retired":
      return "RETIRED";
    default:
      return "AVAILABLE";
  }
}
