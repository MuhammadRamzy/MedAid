import { describe, it, expect } from "vitest";
import { AuthError, ForbiddenError, messageForAuthError } from "./errors";

describe("messageForAuthError", () => {
  it("maps a missing session to a sign-in message", () => {
    expect(messageForAuthError(new AuthError())).toBe("Please sign in again.");
  });

  it("maps insufficient role to a permission message", () => {
    expect(messageForAuthError(new ForbiddenError())).toBe(
      "You do not have permission to do that."
    );
  });

  it("returns null for unrelated errors so callers can handle them", () => {
    expect(messageForAuthError(new Error("firestore unavailable"))).toBeNull();
  });
});
