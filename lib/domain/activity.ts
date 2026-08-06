export type ActivityAction =
  | "USER_CREATED"
  | "USER_SELF_REGISTERED"
  | "USER_APPROVED"
  | "USER_ROLE_CHANGED"
  | "USER_DISABLED"
  | "USER_ENABLED"
  | "USER_DELETED"
  | "ITEM_REGISTERED"
  | "ITEM_UPDATED"
  | "ITEM_DELETED"
  | "ALLOCATED"
  | "CHECKED_IN";

export type ActivityTargetType = "user" | "item" | "allocation";

/** Present-tense label for the activity screen — keep in sync with ActivityAction. */
export function labelForAction(action: ActivityAction): string {
  switch (action) {
    case "USER_CREATED":
      return "Account created";
    case "USER_SELF_REGISTERED":
      return "Requested access";
    case "USER_APPROVED":
      return "Account approved";
    case "USER_ROLE_CHANGED":
      return "Role changed";
    case "USER_DISABLED":
      return "Account disabled";
    case "USER_ENABLED":
      return "Account enabled";
    case "USER_DELETED":
      return "Account deleted";
    case "ITEM_REGISTERED":
      return "Device registered";
    case "ITEM_UPDATED":
      return "Device updated";
    case "ITEM_DELETED":
      return "Device deleted";
    case "ALLOCATED":
      return "Given out";
    case "CHECKED_IN":
      return "Checked in";
  }
}
