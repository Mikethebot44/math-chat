import type { ModelMessage } from "ai";
import { truncateMessages } from "./token-utils";

export function getModelInputTokenBudget({
  context_window,
  max_tokens,
}: {
  context_window: number;
  max_tokens: number;
}) {
  if (context_window <= 0) {
    return null;
  }

  const budget = context_window - Math.max(max_tokens, 0);
  return budget > 0 ? budget : null;
}

export function truncateModelMessagesToFitBudget(
  messages: ModelMessage[],
  modelLimits: {
    context_window: number;
    max_tokens: number;
  }
) {
  const budget = getModelInputTokenBudget(modelLimits);
  return budget ? truncateMessages(messages, budget, false) : messages;
}
