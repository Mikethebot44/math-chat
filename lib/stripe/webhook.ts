import type Stripe from "stripe";
import {
  getCreditTopUpByIdOrStripeSessionId,
  markCreditTopUpCompletedAndAddCredits,
  markCreditTopUpExpired,
  markCreditTopUpFailed,
} from "@/lib/db/credits";
import { createModuleLogger } from "@/lib/logger";
import { getStripeClient, getStripeKeyMode } from "@/lib/stripe/server";

const log = createModuleLogger("stripe:webhook");

function normalizePaymentIntentId(
  paymentIntent: Stripe.Checkout.Session["payment_intent"]
): string | null {
  if (typeof paymentIntent === "string") {
    return paymentIntent;
  }

  if (
    paymentIntent &&
    typeof paymentIntent === "object" &&
    "id" in paymentIntent
  ) {
    return paymentIntent.id;
  }

  return null;
}

export async function processStripeWebhookEvent(
  event: Stripe.Event
): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutSessionCompleted(
        event.data.object as Stripe.Checkout.Session
      );
      return;
    case "checkout.session.async_payment_succeeded":
      await handleCheckoutSessionAsyncPaymentSucceeded(
        event.data.object as Stripe.Checkout.Session
      );
      return;
    case "checkout.session.expired":
      await handleCheckoutSessionExpired(
        event.data.object as Stripe.Checkout.Session
      );
      return;
    case "checkout.session.async_payment_failed":
      await handleCheckoutSessionAsyncPaymentFailed(
        event.data.object as Stripe.Checkout.Session
      );
      return;
    default:
      return;
  }
}

export async function reconcileStripeCheckoutSession(
  sessionId: string
): Promise<void> {
  const stripe = getStripeClient();

  for (let attempt = 0; attempt < 3; attempt++) {
    let session: Stripe.Checkout.Session;

    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (error) {
      if (await handleStripeSessionLookupError(error, sessionId)) {
        return;
      }

      throw error;
    }

    if (session.payment_status === "paid") {
      await handlePaidCheckoutSession(session);
      return;
    }

    if (session.status === "expired") {
      await handleCheckoutSessionExpired(session);
      return;
    }

    if (attempt === 2) {
      log.warn(
        {
          paymentStatus: session.payment_status,
          sessionId,
          status: session.status,
        },
        "Stripe checkout session reconciliation reached retry limit without a terminal state"
      );
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 350));
  }
}

async function handleStripeSessionLookupError(
  error: unknown,
  sessionId: string
): Promise<boolean> {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : null;

  if (code !== "resource_missing") {
    return false;
  }

  const keyMode = getStripeKeyMode();
  const sessionMode = sessionId.startsWith("cs_live_")
    ? "live"
    : sessionId.startsWith("cs_test_")
      ? "test"
      : "unknown";

  log.warn(
    {
      keyMode,
      sessionId,
      sessionMode,
    },
    "Stripe checkout session could not be retrieved during reconciliation"
  );

  await markCreditTopUpFailed({
    failureReason: "stripe_checkout_session_missing",
    stripeCheckoutSessionId: sessionId,
  });

  return true;
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
) {
  if (session.payment_status !== "paid") {
    log.warn(
      {
        paymentStatus: session.payment_status,
        sessionId: session.id,
      },
      "Stripe checkout session completed before payment settled"
    );
    return;
  }

  await handlePaidCheckoutSession(session);
}

async function handleCheckoutSessionAsyncPaymentSucceeded(
  session: Stripe.Checkout.Session
) {
  await handlePaidCheckoutSession(session);
}

async function handlePaidCheckoutSession(session: Stripe.Checkout.Session) {
  const creditTopUpId = session.metadata?.creditTopUpId;
  const userId = session.metadata?.userId;

  if (!(creditTopUpId && userId)) {
    log.error(
      {
        metadata: session.metadata,
        sessionId: session.id,
      },
      "Stripe paid session missing required metadata"
    );
    return;
  }

  const topUp = await getCreditTopUpByIdOrStripeSessionId({
    creditTopUpId,
    stripeCheckoutSessionId: session.id,
  });

  if (!topUp) {
    log.error(
      { creditTopUpId, sessionId: session.id },
      "Credit top-up not found"
    );
    return;
  }

  if (topUp.userId !== userId || session.client_reference_id !== userId) {
    await markCreditTopUpFailed({
      creditTopUpId: topUp.id,
      failureReason: "stripe_user_mismatch",
      stripeCheckoutSessionId: session.id,
    });
    log.error(
      {
        clientReferenceId: session.client_reference_id,
        expectedUserId: topUp.userId,
        metadataUserId: userId,
        sessionId: session.id,
      },
      "Stripe paid session user mismatch"
    );
    return;
  }

  if (session.amount_total !== topUp.amountCents) {
    await markCreditTopUpFailed({
      creditTopUpId: topUp.id,
      failureReason: "stripe_amount_mismatch",
      stripeCheckoutSessionId: session.id,
    });
    log.error(
      {
        expectedAmountCents: topUp.amountCents,
        sessionAmountCents: session.amount_total,
        sessionId: session.id,
        topUpId: topUp.id,
      },
      "Stripe paid session amount mismatch"
    );
    return;
  }

  await markCreditTopUpCompletedAndAddCredits({
    creditTopUpId: topUp.id,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: normalizePaymentIntentId(session.payment_intent),
  });
}

async function handleCheckoutSessionExpired(session: Stripe.Checkout.Session) {
  await markCreditTopUpExpired({
    creditTopUpId: session.metadata?.creditTopUpId,
    stripeCheckoutSessionId: session.id,
  });
}

async function handleCheckoutSessionAsyncPaymentFailed(
  session: Stripe.Checkout.Session
) {
  await markCreditTopUpFailed({
    creditTopUpId: session.metadata?.creditTopUpId,
    failureReason: "stripe_async_payment_failed",
    stripeCheckoutSessionId: session.id,
  });
}
