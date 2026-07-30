export type ContributionMethod = "cash" | "upi" | "bank_transfer";
export type ContributionStage = "checkout" | "checkin";

export interface ContributionInput {
  amount: number;
  method: ContributionMethod;
  reference: string;
}

export type ContributionValidation =
  | { valid: true; contribution: ContributionInput }
  | { valid: false; error: string };

const METHODS: ContributionMethod[] = ["cash", "upi", "bank_transfer"];

/**
 * A contribution is always optional — most handouts involve no money — so
 * this only runs when a volunteer has actually entered an amount. The server
 * must not trust that the client enforced a positive amount or a known
 * payment method.
 */
export function validateContribution(input: unknown): ContributionValidation {
  if (typeof input !== "object" || input === null) {
    return { valid: false, error: "Contribution details are required." };
  }

  const data = input as Record<string, unknown>;
  const amount = typeof data.amount === "number" ? data.amount : NaN;
  const method = data.method as ContributionMethod;
  const reference = typeof data.reference === "string" ? data.reference.trim() : "";

  if (!Number.isFinite(amount) || amount <= 0) {
    return { valid: false, error: "Contribution amount must be a positive number." };
  }
  if (!METHODS.includes(method)) {
    return { valid: false, error: "Contribution method must be cash, UPI, or bank transfer." };
  }

  return { valid: true, contribution: { amount, method, reference } };
}
