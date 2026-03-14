import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  processStripeWebhookEvent,
  reconcileStripeCheckoutSession,
} from "./webhook";

const creditsDb = vi.hoisted(() => ({
  getCreditTopUpByIdOrStripeSessionId: vi.fn(),
  markCreditTopUpCompletedAndAddCredits: vi.fn(),
  markCreditTopUpExpired: vi.fn(),
  markCreditTopUpFailed: vi.fn(),
}));

const logger = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
}));

const stripeClient = vi.hoisted(() => ({
  checkout: {
    sessions: {
      retrieve: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db/credits", () => creditsDb);
vi.mock("@/lib/logger", () => ({
  createModuleLogger: () => logger,
}));
vi.mock("@/lib/stripe/server", () => ({
  getStripeKeyMode: () => "test",
  getStripeClient: () => stripeClient,
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
    payment_status: "paid",
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

    expect(
      creditsDb.markCreditTopUpCompletedAndAddCredits
    ).toHaveBeenCalledWith({
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
    expect(
      creditsDb.markCreditTopUpCompletedAndAddCredits
    ).not.toHaveBeenCalled();
  });

  it("does not credit an unpaid completed checkout session", async () => {
    creditsDb.getCreditTopUpByIdOrStripeSessionId.mockResolvedValue({
      amountCents: 500,
      id: "topup-1",
      userId: "user-1",
    });

    await processStripeWebhookEvent(
      createEvent(
        "checkout.session.completed",
        createCheckoutSession({ payment_status: "unpaid" })
      )
    );

    expect(
      creditsDb.markCreditTopUpCompletedAndAddCredits
    ).not.toHaveBeenCalled();
    expect(creditsDb.markCreditTopUpFailed).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      {
        paymentStatus: "unpaid",
        sessionId: "cs_test_123",
      },
      "Stripe checkout session completed before payment settled"
    );
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

  it("credits async payment successes after settlement", async () => {
    creditsDb.getCreditTopUpByIdOrStripeSessionId.mockResolvedValue({
      amountCents: 500,
      id: "topup-1",
      userId: "user-1",
    });

    await processStripeWebhookEvent(
      createEvent(
        "checkout.session.async_payment_succeeded",
        createCheckoutSession()
      )
    );

    expect(
      creditsDb.markCreditTopUpCompletedAndAddCredits
    ).toHaveBeenCalledWith({
      creditTopUpId: "topup-1",
      stripeCheckoutSessionId: "cs_test_123",
      stripePaymentIntentId: "pi_123",
    });
  });

  it("reconciles a paid checkout session directly from Stripe", async () => {
    creditsDb.getCreditTopUpByIdOrStripeSessionId.mockResolvedValue({
      amountCents: 500,
      id: "topup-1",
      userId: "user-1",
    });
    stripeClient.checkout.sessions.retrieve.mockResolvedValue(
      createCheckoutSession({
        payment_status: "paid",
        status: "complete",
      })
    );

    await reconcileStripeCheckoutSession("cs_test_123");

    expect(stripeClient.checkout.sessions.retrieve).toHaveBeenCalledWith(
      "cs_test_123"
    );
    expect(
      creditsDb.markCreditTopUpCompletedAndAddCredits
    ).toHaveBeenCalledWith({
      creditTopUpId: "topup-1",
      stripeCheckoutSessionId: "cs_test_123",
      stripePaymentIntentId: "pi_123",
    });
  });

  it("fails missing checkout sessions during reconciliation", async () => {
    stripeClient.checkout.sessions.retrieve.mockRejectedValue({
      code: "resource_missing",
    });

    await expect(
      reconcileStripeCheckoutSession("cs_live_missing")
    ).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledWith(
      {
        keyMode: "test",
        sessionId: "cs_live_missing",
        sessionMode: "live",
      },
      "Stripe checkout session could not be retrieved during reconciliation"
    );
    expect(creditsDb.markCreditTopUpFailed).toHaveBeenCalledWith({
      failureReason: "stripe_checkout_session_missing",
      stripeCheckoutSessionId: "cs_live_missing",
    });
  });
});
