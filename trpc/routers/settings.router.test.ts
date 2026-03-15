import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/test";
  process.env.AUTH_SECRET = "test-secret";
});

import { createCallerFactory } from "@/trpc/init";
import { settingsRouter } from "./settings.router";

const createApiKey = vi.hoisted(() => vi.fn());
const maskApiKey = vi.hoisted(() => vi.fn());
const getUserApiKeyByUserId = vi.hoisted(() => vi.fn());
const upsertUserApiKey = vi.hoisted(() => vi.fn());
const getCredits = vi.hoisted(() => vi.fn());
const getUserModelPreferences = vi.hoisted(() => vi.fn());
const upsertUserModelPreference = vi.hoisted(() => vi.fn());
const getUserPreferences = vi.hoisted(() => vi.fn());
const upsertUserPreferences = vi.hoisted(() => vi.fn());
const normalizeUserPreferences = vi.hoisted(() => vi.fn((value) => value));

vi.mock("@/lib/api/api-key", () => ({
  createApiKey,
  maskApiKey,
}));

vi.mock("@/lib/db/api-access", () => ({
  getUserApiKeyByUserId,
  upsertUserApiKey,
}));

vi.mock("@/lib/db/credits", () => ({
  getCredits,
}));

vi.mock("@/lib/db/queries", () => ({
  getUserModelPreferences,
  upsertUserModelPreference,
}));

vi.mock("@/lib/db/user-preferences", () => ({
  getUserPreferences,
  upsertUserPreferences,
}));

vi.mock("@/lib/settings/user-preferences", async () => {
  const actual = await vi.importActual("@/lib/settings/user-preferences");
  return {
    ...actual,
    normalizeUserPreferences,
  };
});

const createCaller = createCallerFactory(settingsRouter);

function getCaller() {
  return createCaller({
    user: {
      id: "user-1",
      email: "ada@example.com",
      name: "Ada",
      emailVerified: true,
      image: null,
      createdAt: new Date("2026-03-14T00:00:00.000Z"),
      updatedAt: new Date("2026-03-14T00:00:00.000Z"),
    },
  });
}

describe("settingsRouter API access procedures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserPreferences.mockResolvedValue(null);
    getUserModelPreferences.mockResolvedValue([]);
  });

  it("returns API access metadata for the current user", async () => {
    getCredits.mockResolvedValue(250);
    getUserApiKeyByUserId.mockResolvedValue({
      createdAt: new Date("2026-03-14T00:00:00.000Z"),
      keyPrefix: "scout_sk_abcd",
      keySuffix: "wxyz",
      lastUsedAt: null,
      rotatedAt: new Date("2026-03-14T00:00:00.000Z"),
      userId: "user-1",
    });
    maskApiKey.mockReturnValue("scout_sk_abcd...wxyz");

    const result = await getCaller().getApiAccess();

    expect(result).toMatchObject({
      credits: 250,
      hasKey: true,
      maskedKey: "scout_sk_abcd...wxyz",
    });
  });

  it("rotates and returns a new API key", async () => {
    createApiKey.mockReturnValue({
      plaintext: "scout_sk_plaintext",
      keyHash: "hash",
      keyPrefix: "scout_sk_abcd",
      keySuffix: "wxyz",
    });
    upsertUserApiKey.mockResolvedValue({
      createdAt: new Date("2026-03-14T00:00:00.000Z"),
      keyPrefix: "scout_sk_abcd",
      keySuffix: "wxyz",
      lastUsedAt: null,
      rotatedAt: new Date("2026-03-14T00:00:00.000Z"),
      userId: "user-1",
    });
    getCredits.mockResolvedValue(250);
    maskApiKey.mockReturnValue("scout_sk_abcd...wxyz");

    const result = await getCaller().rotateApiKey();

    expect(upsertUserApiKey).toHaveBeenCalledWith({
      userId: "user-1",
      keyHash: "hash",
      keyPrefix: "scout_sk_abcd",
      keySuffix: "wxyz",
    });
    expect(result).toMatchObject({
      apiKey: "scout_sk_plaintext",
      credits: 250,
      hasKey: true,
      maskedKey: "scout_sk_abcd...wxyz",
    });
  });
});
