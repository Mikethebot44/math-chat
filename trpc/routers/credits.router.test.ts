import { beforeEach, describe, expect, it, vi } from "vitest";

const creditsDb = vi.hoisted(() => ({
  attachStripeSessionToCreditTopUp: vi.fn(),
  createCreditTopUp: vi.fn(),
  getCreditTopUpForUserBySessionId: vi.fn(),
  getCredits: vi.fn(),
  listCreditTopUpsForUser: vi.fn(),
  markCreditTopUpFailed: vi.fn(),
}));

const logger = vi.hoisted(() => ({
  warn: vi.fn(),
}));

const stripeServer = vi.hoisted(() => ({
  getStripeClient: vi.fn(),
  isStripeConfigured: vi.fn(() => true),
}));

const stripeWebhook = vi.hoisted(() => ({
  reconcileStripeCheckoutSession: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock("@/lib/config", () => ({
  config: {
    appName: "Chat",
    appUrl: "http://localhost:3000",
  },
}));

vi.mock("@/lib/db/credits", () => creditsDb);
vi.mock("@/lib/logger", () => ({
  createModuleLogger: () => logger,
}));
vi.mock("@/lib/stripe/server", () => stripeServer);
vi.mock("@/lib/stripe/webhook", () => stripeWebhook);

import { createCallerFactory } from "@/trpc/init";
import { creditsRouter } from "./credits.router";

const createCaller = createCallerFactory(creditsRouter);

describe("creditsRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stripeServer.isStripeConfigured.mockReturnValue(true);
  });

  it("returns billing data when Stripe reconciliation fails during reads", async () => {
    const pendingTopUp = {
      amountCents: 500,
      completedAt: null,
      createdAt: new Date("2026-03-14T00:00:00.000Z"),
      creditsToAdd: 500,
      failureReason: null,
      id: "topup-1",
      status: "pending",
      stripeCheckoutSessionId: "cs_test_123",
    };

    creditsDb.getCredits.mockResolvedValue(750);
    creditsDb.listCreditTopUpsForUser.mockResolvedValue([pendingTopUp]);
    stripeWebhook.reconcileStripeCheckoutSession.mockRejectedValue(
      new Error("stripe unavailable")
    );

    const caller = createCaller({
      user: {
        id: "user-1",
      } as never,
    });

    await expect(caller.getBillingOverview()).resolves.toEqual({
      currentCredits: 750,
      recentTopUps: [pendingTopUp],
      stripeConfigured: true,
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "cs_test_123",
        userId: "user-1",
      }),
      "Stripe checkout reconciliation failed during billing read"
    );
  });

  it("returns the persisted top-up status when Stripe reconciliation fails", async () => {
    const pendingTopUp = {
      amountCents: 500,
      completedAt: null,
      createdAt: new Date("2026-03-14T00:00:00.000Z"),
      creditsToAdd: 500,
      failureReason: null,
      id: "topup-1",
      status: "pending",
    };

    creditsDb.getCreditTopUpForUserBySessionId.mockResolvedValue(pendingTopUp);
    stripeWebhook.reconcileStripeCheckoutSession.mockRejectedValue(
      new Error("stripe unavailable")
    );

    const caller = createCaller({
      user: {
        id: "user-1",
      } as never,
    });

    await expect(
      caller.getTopUpStatus({ sessionId: "cs_test_123" })
    ).resolves.toEqual({
      amountCents: 500,
      completedAt: null,
      createdAt: pendingTopUp.createdAt,
      creditsToAdd: 500,
      failureReason: null,
      id: "topup-1",
      status: "pending",
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "cs_test_123",
        userId: "user-1",
      }),
      "Stripe checkout reconciliation failed during billing read"
    );
  });
});
