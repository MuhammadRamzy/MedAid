export class AuthError extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "AuthError";
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super("Not authorized");
    this.name = "ForbiddenError";
  }
}

/**
 * Server actions return { success, error } rather than throwing across the
 * boundary. This maps guard failures to text safe to show a volunteer, and
 * returns null for anything else so real faults are not masked.
 */
export function messageForAuthError(error: unknown): string | null {
  if (error instanceof AuthError) return "Please sign in again.";
  if (error instanceof ForbiddenError) return "You do not have permission to do that.";
  return null;
}
