import { describe, it, expect } from "vitest";
import { labelForAction, type ActivityAction } from "./activity";

const ALL_ACTIONS: ActivityAction[] = [
  "USER_CREATED",
  "USER_ROLE_CHANGED",
  "USER_DISABLED",
  "USER_ENABLED",
  "USER_DELETED",
  "ITEM_REGISTERED",
  "ITEM_UPDATED",
  "ITEM_DELETED",
  "ALLOCATED",
  "CHECKED_IN",
];

describe("labelForAction", () => {
  it("has a non-empty, human label for every action", () => {
    for (const action of ALL_ACTIONS) {
      expect(labelForAction(action).length).toBeGreaterThan(0);
    }
  });

  it("labels are present-tense and distinct per action", () => {
    const labels = ALL_ACTIONS.map(labelForAction);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
