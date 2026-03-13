import type Stripe from "stripe";
import {
  getCreditTopUpByIdOrStripeSessionId,
  markCreditTopUpCompletedAndAddCredits,
  markCreditTopUpExpired,
  markCreditTopUpFailed,
} from "@/lib/db/credits";
import { createModuleLogger } from "@/lib/logger";

const log = createModuleLogger("stripe:webhook");

function normalizePaymentIntentId(
  paymentIntent: Stripe.Checkout.Session["payment_intent"]
): string | null {
  if (typeof paymentIntent === "string") {
    return paymentIntent;
  }

  if (paymentIntent && typeof paymentIntent === "object" && "id" in paymentIntent) {
    return paymentIntent.id;
  }

  return null;
}

export async function processStripeWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutSessionCompleted(
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

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
) {
  const creditTopUpId = session.metadata?.creditTopUpId;
  const userId = session.metadata?.userId;

  if (!(creditTopUpId && userId)) {
    log.error(
      {
        metadata: session.metadata,
        sessionId: session.id,
      },
      "Stripe completed session missing required metadata"
    );
    return;
  }

  const topUp = await getCreditTopUpByIdOrStripeSessionId({
    creditTopUpId,
    stripeCheckoutSessionId: session.id,
  });

  if (!topUp) {
    log.error({ creditTopUpId, sessionId: session.id }, "Credit top-up not found");
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
      "Stripe completed session user mismatch"
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
      "Stripe completed session amount mismatch"
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
