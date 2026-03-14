export const CREDIT_TOP_UP_CURRENCY = "usd";
export const MIN_CREDIT_TOP_UP_DOLLARS = 5;

export const CREDIT_TOP_UP_STATUSES = [
  "initiated",
  "pending",
  "completed",
  "expired",
  "failed",
] as const;

export type CreditTopUpStatus = (typeof CREDIT_TOP_UP_STATUSES)[number];

export function topUpAmountDollarsToRoundedCents(amountDollars: number): number {
  return Math.round(amountDollars * 100);
}

export function topUpAmountDollarsToCents(amountDollars: number): number {
  const amountCents = topUpAmountDollarsToRoundedCents(amountDollars);

  if (!isValidTopUpAmountDollars(amountDollars)) {
    throw new Error("Top-up amount must be a valid USD amount in whole cents");
  }

  return amountCents;
}

export function isValidTopUpAmountDollars(amountDollars: number): boolean {
  if (!Number.isFinite(amountDollars)) {
    return false;
  }

  const amountCents = topUpAmountDollarsToRoundedCents(amountDollars);
  const isWholeCent = Math.abs(amountDollars * 100 - amountCents) < 1e-6;

  return isWholeCent && amountCents >= MIN_CREDIT_TOP_UP_DOLLARS * 100;
}

export function isTerminalCreditTopUpStatus(
  status: CreditTopUpStatus
): boolean {
  return status === "completed" || status === "expired" || status === "failed";
}
