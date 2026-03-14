import { beforeEach, describe, expect, it, vi } from "vitest";

const createCoreChatAgent = vi.hoisted(() => vi.fn());
const determineExplicitlyRequestedTools = vi.hoisted(() => vi.fn(() => null));
const generateFollowupSuggestions = vi.hoisted(() => vi.fn());
const systemPrompt = vi.hoisted(() => vi.fn(() => "system prompt"));
const getUserPreferences = vi.hoisted(() => vi.fn());
const generateUUID = vi.hoisted(() => vi.fn(() => "assistant-message-id"));

vi.mock("@/lib/ai/core-chat-agent", () => ({
  createCoreChatAgent,
}));

vi.mock("@/lib/ai/determine-explicitly-requested-tools", () => ({
  determineExplicitlyRequestedTools,
}));

vi.mock("@/lib/ai/followup-suggestions", () => ({
  generateFollowupSuggestions,
}));

vi.mock("@/lib/ai/prompts", () => ({
  systemPrompt,
}));

vi.mock("@/lib/credits/cost-accumulator", () => ({
  CostAccumulator: class {},
}));

vi.mock("@/lib/db/user-preferences", () => ({
  getUserPreferences,
}));

vi.mock("@/lib/utils", () => ({
  generateUUID,
}));

import { runCoreChatAgentEval } from "./eval-agent";

function createAsyncIterable<T>(values: T[]): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const value of values) {
        yield value;
      }
    },
  };
}

function createEvalResult() {
  return {
    consumeStream: vi.fn(async () => undefined),
    output: Promise.resolve("assistant output"),
    response: Promise.resolve({ messages: [] }),
    steps: Promise.resolve([]),
    usage: Promise.resolve(undefined),
  };
}

function createUserMessage() {
  return {
    id: "user-message-id",
    metadata: {
      activeStreamId: null,
      createdAt: new Date("2026-03-14T00:00:00.000Z"),
      parentMessageId: null,
      selectedModel: "scout-model",
    },
    parts: [{ text: "hello", type: "text" as const }],
    role: "user" as const,
  };
}

describe("runCoreChatAgentEval", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    createCoreChatAgent.mockResolvedValue({
      contextForLLM: [],
      result: createEvalResult(),
    });
    generateFollowupSuggestions.mockResolvedValue({
      partialOutputStream: createAsyncIterable([]),
    });
  });

  it("skips loading user preferences when no userId is provided", async () => {
    await runCoreChatAgentEval({
      activeTools: [],
      previousMessages: [],
      selectedModelId: "scout-model",
      selectedTool: null,
      userId: null,
      userMessage: createUserMessage(),
    });

    expect(getUserPreferences).not.toHaveBeenCalled();
    expect(systemPrompt).toHaveBeenCalledWith({ userPreferences: null });
  });

  it("loads user preferences only when a userId is provided", async () => {
    getUserPreferences.mockResolvedValue({
      additionalContext: "",
      assistantTraits: [],
      occupation: "",
      preferredName: "Ada",
    });

    await runCoreChatAgentEval({
      activeTools: [],
      previousMessages: [],
      selectedModelId: "scout-model",
      selectedTool: null,
      userId: "user-1",
      userMessage: createUserMessage(),
    });

    expect(getUserPreferences).toHaveBeenCalledWith({ userId: "user-1" });
    expect(systemPrompt).toHaveBeenCalledWith({
      userPreferences: {
        additionalContext: "",
        assistantTraits: [],
        occupation: "",
        preferredName: "Ada",
      },
    });
  });
});
