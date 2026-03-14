import { beforeEach, describe, expect, it, vi } from "vitest";

const ai = vi.hoisted(() => ({
  convertToModelMessages: vi.fn(async (messages) => messages),
  generateText: vi.fn(async () => ({
    text: "Continuation message",
    usage: undefined,
  })),
}));

const authApi = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

const anonymousSessionStore = vi.hoisted(() => ({
  getAnonymousSession: vi.fn(),
}));

const aristotleClient = vi.hoisted(() => ({
  checkAristotleJobStatus: vi.fn(),
}));

const creditsDb = vi.hoisted(() => ({
  deductCredits: vi.fn(),
}));

const dbQueries = vi.hoisted(() => ({
  getAllMessagesByChatId: vi.fn(),
  getChatById: vi.fn(),
  getChatMessageWithPartsById: vi.fn(),
  getProjectById: vi.fn(),
  saveMessage: vi.fn(),
  updateMessage: vi.fn(),
}));

const userPreferencesDb = vi.hoisted(() => ({
  getUserPreferences: vi.fn(),
}));

const generateUUID = vi.hoisted(() => vi.fn());

vi.mock("ai", () => ai);
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));
vi.mock("@/app/(chat)/api/chat/filter-reasoning-parts", () => ({
  filterPartsForLLM: vi.fn((messages) => messages),
}));
vi.mock("@/lib/ai/prompts", () => ({
  systemPrompt: vi.fn(() => "system prompt"),
}));
vi.mock("@/lib/ai/providers", () => ({
  getLanguageModel: vi.fn(async () => "model"),
  getModelProviderOptions: vi.fn(async () => ({})),
}));
vi.mock("@/lib/ai/scout-models", () => ({
  DEFAULT_SCOUT_MODEL_ID: "scout-model",
}));
vi.mock("@/lib/ai/tools/lean-proof/aristotle-client", () => aristotleClient);
vi.mock("@/lib/anonymous-session-server", () => anonymousSessionStore);
vi.mock("@/lib/auth", () => ({
  auth: {
    api: authApi,
  },
}));
vi.mock("@/lib/credits/cost-accumulator", () => ({
  CostAccumulator: class {
    addLLMCost() {}

    async getTotalCost() {
      return 0;
    }
  },
}));
vi.mock("@/lib/db/credits", () => creditsDb);
vi.mock("@/lib/db/queries", () => dbQueries);
vi.mock("@/lib/db/user-preferences", () => userPreferencesDb);
vi.mock("@/lib/thread-utils", () => ({
  buildThreadFromLeaf: vi.fn((messages) => messages),
}));
vi.mock("@/lib/utils", () => ({
  generateUUID,
}));
vi.mock("@/lib/utils/download-assets", () => ({
  replaceFilePartUrlByBinaryDataInMessages: vi.fn(async (messages) => messages),
}));

import { POST } from "./route";

describe("POST /api/chat/[id]/aristotle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateUUID.mockReturnValue("generated-id");
    anonymousSessionStore.getAnonymousSession.mockResolvedValue(null);
    authApi.getSession.mockResolvedValue({
      user: {
        id: "viewer-1",
      },
    });
    aristotleClient.checkAristotleJobStatus.mockResolvedValue({
      completed: true,
      failed: false,
      jobId: "job-1",
      status: "completed",
    });
    dbQueries.getChatById.mockResolvedValue({
      id: "chat-1",
      projectId: null,
      userId: "owner-1",
      visibility: "public",
    });
    dbQueries.getProjectById.mockResolvedValue(null);
    dbQueries.saveMessage.mockResolvedValue(undefined);
    dbQueries.updateMessage.mockResolvedValue(undefined);
  });

  it("builds the continuation prompt with the acting viewer's preferences", async () => {
    const sourceMessage = {
      id: "message-1",
      metadata: {
        createdAt: new Date("2026-03-14T00:00:00.000Z"),
        parentMessageId: null,
        selectedModel: "scout-model",
      },
      parts: [
        {
          output: {
            completed: false,
            jobId: "job-1",
            status: "running",
          },
          state: "output-available",
          type: "tool-leanProof",
        },
      ],
      role: "assistant",
    };

    dbQueries.getChatMessageWithPartsById.mockResolvedValue({
      chatId: "chat-1",
      message: sourceMessage,
    });
    dbQueries.getAllMessagesByChatId.mockResolvedValue([sourceMessage]);
    userPreferencesDb.getUserPreferences.mockImplementation(async ({ userId }) => {
      if (userId !== "viewer-1") {
        throw new Error(`unexpected user preferences lookup for ${userId}`);
      }

      return {
        additionalContext: null,
        occupation: null,
        preferredName: "Viewer",
      };
    });

    const response = await POST(
      new Request("http://localhost/api/chat/chat-1/aristotle", {
        body: JSON.stringify({ messageId: "message-1" }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
      { params: Promise.resolve({ id: "chat-1" }) }
    );

    expect(response.status).toBe(200);
    expect(userPreferencesDb.getUserPreferences).toHaveBeenCalledWith({
      userId: "viewer-1",
    });
    expect(userPreferencesDb.getUserPreferences).not.toHaveBeenCalledWith({
      userId: "owner-1",
    });
  });
});
