import type { ModelMessage } from "ai";
import { calculateMessagesTokens, truncateMessages } from "./token-utils";

export function getModelInputTokenBudget({
  context_window,
  max_tokens,
  system,
}: {
  context_window: number;
  max_tokens: number;
  system?: string;
}) {
  if (context_window <= 0) {
    return null;
  }

  const reservedSystemTokens = system
    ? calculateMessagesTokens([{ role: "system", content: system }])
    : 0;
  const budget =
    context_window - Math.max(max_tokens, 0) - reservedSystemTokens;
  return budget > 0 ? budget : 0;
}

export function truncateModelMessagesToFitBudget(
  messages: ModelMessage[],
  modelLimits: {
    context_window: number;
    max_tokens: number;
  },
  options?: {
    system?: string;
  }
) {
  const budget = getModelInputTokenBudget({
    ...modelLimits,
    system: options?.system,
  });

  return budget === null ? messages : truncateMessages(messages, budget, false);
}
