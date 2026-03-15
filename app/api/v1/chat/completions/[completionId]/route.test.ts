import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateApiKey = vi.hoisted(() => vi.fn());
const pollProgrammaticCompletion = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/auth", () => ({
  authenticateApiKey,
}));

vi.mock("@/lib/api/chat-completions", () => ({
  pollProgrammaticCompletion,
}));

import { GET } from "./route";

describe("GET /api/v1/chat/completions/[completionId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when the API key is invalid", async () => {
    authenticateApiKey.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/v1/chat/completions/cmpl_1") as never,
      { params: Promise.resolve({ completionId: "cmpl_1" }) }
    );

    expect(response.status).toBe(401);
  });

  it("returns 404 when the completion is not found", async () => {
    authenticateApiKey.mockResolvedValue({ userId: "user-1" });
    pollProgrammaticCompletion.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/v1/chat/completions/cmpl_1") as never,
      { params: Promise.resolve({ completionId: "cmpl_1" }) }
    );

    expect(response.status).toBe(404);
  });

  it("returns the completion payload when found", async () => {
    authenticateApiKey.mockResolvedValue({ userId: "user-1" });
    pollProgrammaticCompletion.mockResolvedValue({
      id: "cmpl_1",
      object: "chat.completion",
      created: 1,
      model: "Scout",
      status: "IN_PROGRESS",
      choices: [],
      lean_file: null,
      usage: null,
      error: null,
      credits_remaining: 100,
    });

    const response = await GET(
      new Request("http://localhost/api/v1/chat/completions/cmpl_1") as never,
      { params: Promise.resolve({ completionId: "cmpl_1" }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: "cmpl_1",
      status: "IN_PROGRESS",
    });
  });
});
