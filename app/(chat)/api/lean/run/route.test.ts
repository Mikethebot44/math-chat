import { beforeEach, describe, expect, it, vi } from "vitest";

const authApi = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

const anonymousSessionStore = vi.hoisted(() => ({
  getAnonymousSession: vi.fn(),
  setAnonymousSession: vi.fn(),
}));

const leanSandbox = vi.hoisted(() => ({
  createLeanSandbox: vi.fn(),
  getLeanSandboxTimeoutMs: vi.fn(() => 180_000),
  verifyLeanSource: vi.fn(),
}));

const logger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
}));

const redis = vi.hoisted(() => ({
  getRedisClient: vi.fn(),
}));

const rateLimit = vi.hoisted(() => ({
  checkAnonymousRateLimit: vi.fn(),
  getClientIP: vi.fn(() => "127.0.0.1"),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: authApi,
  },
}));

vi.mock("@/lib/anonymous-session-server", () => anonymousSessionStore);
vi.mock("@/lib/ai/tools/lean-proof/lean-sandbox", () => leanSandbox);
vi.mock("@/lib/logger", () => ({
  createModuleLogger: () => logger,
}));
vi.mock("@/lib/redis", () => redis);
vi.mock("@/lib/utils/rate-limit", () => rateLimit);
vi.mock("e2b", () => ({
  Sandbox: {
    connect: vi.fn(),
  },
}));

import { POST } from "./route";

describe("POST /api/lean/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    authApi.getSession.mockResolvedValue(null);
    redis.getRedisClient.mockResolvedValue(null);
    rateLimit.checkAnonymousRateLimit.mockResolvedValue({
      headers: {
        "X-RateLimit-Limit-Minute": "60",
      },
      success: true,
    });
  });

  it("does not deduct anonymous credits when Lean execution fails", async () => {
    const anonymousSession = {
      createdAt: new Date("2026-03-14T00:00:00.000Z"),
      id: "anon-1",
      remainingCredits: 3,
    };
    const sandbox = {
      kill: vi.fn(),
      sandboxId: "sandbox-1",
      setTimeout: vi.fn(),
    };

    anonymousSessionStore.getAnonymousSession.mockResolvedValue(
      anonymousSession
    );
    leanSandbox.createLeanSandbox.mockResolvedValue(sandbox);
    leanSandbox.verifyLeanSource.mockRejectedValue(new Error("sandbox failed"));

    const response = await POST(
      new Request("http://localhost/api/lean/run", {
        body: JSON.stringify({ content: "#check Nat" }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      })
    );

    expect(response.status).toBe(500);
    expect(anonymousSessionStore.setAnonymousSession).not.toHaveBeenCalled();
    expect(sandbox.kill).toHaveBeenCalledTimes(1);
  });

  it("deducts anonymous credits after a successful Lean execution", async () => {
    const anonymousSession = {
      createdAt: new Date("2026-03-14T00:00:00.000Z"),
      id: "anon-1",
      remainingCredits: 3,
    };
    const sandbox = {
      kill: vi.fn(),
      sandboxId: "sandbox-1",
      setTimeout: vi.fn(),
    };

    anonymousSessionStore.getAnonymousSession.mockResolvedValue(
      anonymousSession
    );
    leanSandbox.createLeanSandbox.mockResolvedValue(sandbox);
    leanSandbox.verifyLeanSource.mockResolvedValue({
      command: "lake env lean Main.lean",
      containsHoles: false,
      diagnostics: "",
      exitCode: 0,
      filePath: "/tmp/Main.lean",
      source: "#check Nat",
      stderr: "",
      stdout: "",
      verified: true,
    });

    const response = await POST(
      new Request("http://localhost/api/lean/run", {
        body: JSON.stringify({ content: "#check Nat" }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      })
    );

    expect(response.status).toBe(200);
    expect(anonymousSessionStore.setAnonymousSession).toHaveBeenCalledWith({
      ...anonymousSession,
      remainingCredits: 2,
    });
    expect(sandbox.kill).not.toHaveBeenCalled();
  });
});
