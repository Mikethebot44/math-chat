import { describe, expect, it } from "vitest";
import {
  isValidTopUpAmountDollars,
  isTerminalCreditTopUpStatus,
  topUpAmountDollarsToCents,
} from "./top-up";

describe("credit top-up helpers", () => {
  it("converts dollar amounts with cents to integer cents", () => {
    expect(topUpAmountDollarsToCents(5)).toBe(500);
    expect(topUpAmountDollarsToCents(5.4)).toBe(540);
    expect(topUpAmountDollarsToCents(25)).toBe(2500);
  });

  it("validates amounts as whole cents with a $5 minimum", () => {
    expect(isValidTopUpAmountDollars(5)).toBe(true);
    expect(isValidTopUpAmountDollars(5.4)).toBe(true);
    expect(isValidTopUpAmountDollars(4.99)).toBe(false);
    expect(isValidTopUpAmountDollars(5.401)).toBe(false);
  });

  it("identifies terminal top-up statuses", () => {
    expect(isTerminalCreditTopUpStatus("completed")).toBe(true);
    expect(isTerminalCreditTopUpStatus("expired")).toBe(true);
    expect(isTerminalCreditTopUpStatus("failed")).toBe(true);
    expect(isTerminalCreditTopUpStatus("pending")).toBe(false);
  });
});
