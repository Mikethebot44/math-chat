import { describe, expect, it } from "vitest";
import {
  getModelInputTokenBudget,
  truncateModelMessagesToFitBudget,
} from "./history-truncation";
import { calculateMessagesTokens } from "./token-utils";

describe("history truncation", () => {
  it("reserves tokens for the system prompt", () => {
    const system = "You are a very detailed assistant. ".repeat(20);

    const budgetWithoutSystem = getModelInputTokenBudget({
      context_window: 4000,
      max_tokens: 500,
    });
    const budgetWithSystem = getModelInputTokenBudget({
      context_window: 4000,
      max_tokens: 500,
      system,
    });

    expect(budgetWithoutSystem).not.toBeNull();
    expect(budgetWithSystem).not.toBeNull();
    expect(budgetWithSystem).toBe(
      (budgetWithoutSystem as number) -
        calculateMessagesTokens([{ role: "system", content: system }])
    );
  });

  it("returns no messages when the system prompt consumes the remaining budget", () => {
    const messages = [
      { role: "user" as const, content: "Hello" },
      { role: "assistant" as const, content: "Hi there" },
    ];
    const system = "system ".repeat(200);

    expect(
      truncateModelMessagesToFitBudget(
        messages,
        {
          context_window: 200,
          max_tokens: 50,
        },
        { system }
      )
    ).toEqual([]);
  });

  it("preserves messages when the context window is unknown", () => {
    const messages = [
      { role: "user" as const, content: "Hello" },
      { role: "assistant" as const, content: "Hi there" },
    ];

    expect(
      truncateModelMessagesToFitBudget(messages, {
        context_window: 0,
        max_tokens: 50,
      })
    ).toEqual(messages);
  });
});
