export interface PurchaseAcquisition {
  source: "purchase";
  invoiceNumber: string;
  supplier: string;
  price: number;
  sourceOfFund: string;
}

export interface DonationAcquisition {
  source: "donation";
  contributorName: string;
  /** Optional — a donor's estimate, not a receipt. */
  estimatedValue: number | null;
}

export type Acquisition = PurchaseAcquisition | DonationAcquisition;

export type AcquisitionValidation =
  | { valid: true; acquisition: Acquisition }
  | { valid: false; error: string };

/**
 * A device is registered as either purchased or donated, never both. This is
 * the single place that decides whether an acquisition record is complete —
 * the registration form only ever collects one branch, but the server must
 * not trust that the client enforced it.
 */
export function validateAcquisition(input: unknown): AcquisitionValidation {
  if (typeof input !== "object" || input === null) {
    return { valid: false, error: "Acquisition details are required." };
  }

  const data = input as Record<string, unknown>;

  if (data.source === "purchase") {
    const invoiceNumber = typeof data.invoiceNumber === "string" ? data.invoiceNumber.trim() : "";
    const supplier = typeof data.supplier === "string" ? data.supplier.trim() : "";
    const sourceOfFund = typeof data.sourceOfFund === "string" ? data.sourceOfFund.trim() : "";
    const price = typeof data.price === "number" ? data.price : NaN;

    if (!invoiceNumber) return { valid: false, error: "Invoice number is required for a purchase." };
    if (!supplier) return { valid: false, error: "Supplier is required for a purchase." };
    if (!sourceOfFund) return { valid: false, error: "Source of fund is required for a purchase." };
    if (!Number.isFinite(price) || price <= 0) {
      return { valid: false, error: "Price must be a positive amount." };
    }

    return {
      valid: true,
      acquisition: { source: "purchase", invoiceNumber, supplier, price, sourceOfFund },
    };
  }

  if (data.source === "donation") {
    const contributorName = typeof data.contributorName === "string" ? data.contributorName.trim() : "";
    const rawValue = data.estimatedValue;
    const estimatedValue =
      typeof rawValue === "number" && Number.isFinite(rawValue) && rawValue > 0 ? rawValue : null;

    if (!contributorName) {
      return { valid: false, error: "Contributor name is required for a donation." };
    }

    return { valid: true, acquisition: { source: "donation", contributorName, estimatedValue } };
  }

  return { valid: false, error: "Acquisition source must be 'purchase' or 'donation'." };
}
