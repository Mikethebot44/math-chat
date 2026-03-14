import { describe, expect, it } from "vitest";
import {
  isTerminalCreditTopUpStatus,
  topUpAmountDollarsToCents,
} from "./top-up";

describe("credit top-up helpers", () => {
  it("converts whole-dollar amounts to cents", () => {
    expect(topUpAmountDollarsToCents(5)).toBe(500);
    expect(topUpAmountDollarsToCents(25)).toBe(2500);
  });

  it("identifies terminal top-up statuses", () => {
    expect(isTerminalCreditTopUpStatus("completed")).toBe(true);
    expect(isTerminalCreditTopUpStatus("expired")).toBe(true);
    expect(isTerminalCreditTopUpStatus("failed")).toBe(true);
    expect(isTerminalCreditTopUpStatus("pending")).toBe(false);
  });
});
