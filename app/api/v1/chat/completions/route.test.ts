import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateApiKey = vi.hoisted(() => vi.fn());
const createProgrammaticCompletion = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/auth", () => ({
  authenticateApiKey,
}));

vi.mock("@/lib/api/chat-completions", () => ({
  createApiCompletionRequestSchema: {
    safeParse: (value: unknown) => {
      if (
        !(
          typeof value === "object" &&
          value !== null &&
          "messages" in value &&
          Array.isArray((value as { messages?: unknown }).messages)
        )
      ) {
        return { success: false } as const;
      }

      return {
        success: true,
        data: value,
      } as const;
    },
  },
  createProgrammaticCompletion,
}));

import { POST } from "./route";

describe("POST /api/v1/chat/completions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when the API key is missing or invalid", async () => {
    authenticateApiKey.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/v1/chat/completions", {
        method: "POST",
      }) as never
    );

    expect(response.status).toBe(401);
  });

  it("returns 400 for an invalid request body", async () => {
    authenticateApiKey.mockResolvedValue({ userId: "user-1" });

    const response = await POST(
      new Request("http://localhost/api/v1/chat/completions", {
        method: "POST",
        body: JSON.stringify({}),
        headers: {
          "content-type": "application/json",
        },
      }) as never
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 when streaming is requested", async () => {
    authenticateApiKey.mockResolvedValue({ userId: "user-1" });

    const response = await POST(
      new Request("http://localhost/api/v1/chat/completions", {
        method: "POST",
        body: JSON.stringify({
          messages: [{ role: "user", content: "hello" }],
          stream: true,
        }),
        headers: {
          "content-type": "application/json",
        },
      }) as never
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Streaming is not supported for this API",
    });
  });

  it("returns 400 for an unsupported model", async () => {
    authenticateApiKey.mockResolvedValue({ userId: "user-1" });

    const response = await POST(
      new Request("http://localhost/api/v1/chat/completions", {
        method: "POST",
        body: JSON.stringify({
          model: "Other",
          messages: [{ role: "user", content: "hello" }],
        }),
        headers: {
          "content-type": "application/json",
        },
      }) as never
    );

    expect(response.status).toBe(400);
  });

  it("returns 402 when the account has no credits", async () => {
    authenticateApiKey.mockResolvedValue({ userId: "user-1" });
    createProgrammaticCompletion.mockResolvedValue({
      type: "insufficient_credits",
    });

    const response = await POST(
      new Request("http://localhost/api/v1/chat/completions", {
        method: "POST",
        body: JSON.stringify({
          messages: [{ role: "user", content: "hello" }],
        }),
        headers: {
          "content-type": "application/json",
        },
      }) as never
    );

    expect(response.status).toBe(402);
  });

  it("returns the completion payload on success", async () => {
    authenticateApiKey.mockResolvedValue({ userId: "user-1" });
    createProgrammaticCompletion.mockResolvedValue({
      type: "ok",
      completion: {
        id: "cmpl_1",
        object: "chat.completion",
        created: 1,
        model: "Scout",
        status: "COMPLETED",
        choices: [],
        lean_file: null,
        usage: null,
        error: null,
        credits_remaining: 100,
      },
    });

    const response = await POST(
      new Request("http://localhost/api/v1/chat/completions", {
        method: "POST",
        body: JSON.stringify({
          model: "Scout",
          messages: [{ role: "user", content: "hello" }],
        }),
        headers: {
          "content-type": "application/json",
        },
      }) as never
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: "cmpl_1",
      status: "COMPLETED",
    });
  });
});
