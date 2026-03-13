import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { processStripeWebhookEvent } from "./webhook";

const creditsDb = vi.hoisted(() => ({
  getCreditTopUpByIdOrStripeSessionId: vi.fn(),
  markCreditTopUpCompletedAndAddCredits: vi.fn(),
  markCreditTopUpExpired: vi.fn(),
  markCreditTopUpFailed: vi.fn(),
}));

const logger = vi.hoisted(() => ({
  error: vi.fn(),
}));

vi.mock("@/lib/db/credits", () => creditsDb);
vi.mock("@/lib/logger", () => ({
  createModuleLogger: () => logger,
}));

function createCheckoutSession(
  overrides: Partial<Stripe.Checkout.Session> = {}
): Stripe.Checkout.Session {
  return {
    amount_total: 500,
    client_reference_id: "user-1",
    id: "cs_test_123",
    metadata: {
      creditTopUpId: "topup-1",
      userId: "user-1",
    },
    object: "checkout.session",
    payment_intent: "pi_123",
    ...overrides,
  } as Stripe.Checkout.Session;
}

function createEvent(
  type: Stripe.Event.Type,
  session: Stripe.Checkout.Session
): Stripe.Event {
  return {
    data: {
      object: session,
    },
    id: "evt_test_123",
    object: "event",
    type,
  } as Stripe.Event;
}

describe("processStripeWebhookEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("completes and credits a matching checkout session", async () => {
    creditsDb.getCreditTopUpByIdOrStripeSessionId.mockResolvedValue({
      amountCents: 500,
      id: "topup-1",
      userId: "user-1",
    });

    await processStripeWebhookEvent(
      createEvent("checkout.session.completed", createCheckoutSession())
    );

    expect(creditsDb.markCreditTopUpCompletedAndAddCredits).toHaveBeenCalledWith({
      creditTopUpId: "topup-1",
      stripeCheckoutSessionId: "cs_test_123",
      stripePaymentIntentId: "pi_123",
    });
    expect(creditsDb.markCreditTopUpFailed).not.toHaveBeenCalled();
  });

  it("marks the top-up as failed when Stripe amount does not match", async () => {
    creditsDb.getCreditTopUpByIdOrStripeSessionId.mockResolvedValue({
      amountCents: 500,
      id: "topup-1",
      userId: "user-1",
    });

    await processStripeWebhookEvent(
      createEvent(
        "checkout.session.completed",
        createCheckoutSession({ amount_total: 900 })
      )
    );

    expect(creditsDb.markCreditTopUpFailed).toHaveBeenCalledWith({
      creditTopUpId: "topup-1",
      failureReason: "stripe_amount_mismatch",
      stripeCheckoutSessionId: "cs_test_123",
    });
    expect(creditsDb.markCreditTopUpCompletedAndAddCredits).not.toHaveBeenCalled();
  });

  it("marks expired checkout sessions", async () => {
    await processStripeWebhookEvent(
      createEvent("checkout.session.expired", createCheckoutSession())
    );

    expect(creditsDb.markCreditTopUpExpired).toHaveBeenCalledWith({
      creditTopUpId: "topup-1",
      stripeCheckoutSessionId: "cs_test_123",
    });
  });

  it("marks async payment failures", async () => {
    await processStripeWebhookEvent(
      createEvent(
        "checkout.session.async_payment_failed",
        createCheckoutSession()
      )
    );

    expect(creditsDb.markCreditTopUpFailed).toHaveBeenCalledWith({
      creditTopUpId: "topup-1",
      failureReason: "stripe_async_payment_failed",
      stripeCheckoutSessionId: "cs_test_123",
    });
  });
});
