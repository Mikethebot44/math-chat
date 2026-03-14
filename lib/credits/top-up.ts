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

export function topUpAmountDollarsToCents(amountDollars: number): number {
  return amountDollars * 100;
}

export function isTerminalCreditTopUpStatus(
  status: CreditTopUpStatus
): boolean {
  return status === "completed" || status === "expired" || status === "failed";
}
