import type Stripe from "stripe";
import { env } from "@/lib/env";
import { createModuleLogger } from "@/lib/logger";
import { getStripeClient } from "@/lib/stripe/server";
import { processStripeWebhookEvent } from "@/lib/stripe/webhook";

const log = createModuleLogger("api:stripe:webhook");

export async function POST(request: Request) {
  if (!env.STRIPE_SECRET_KEY) {
    log.error("Received Stripe webhook request without STRIPE_SECRET_KEY");
    return new Response("Stripe webhook is not configured", { status: 503 });
  }

  if (!env.STRIPE_WEBHOOK_SECRET) {
    log.error("Received Stripe webhook request without STRIPE_WEBHOOK_SECRET");
    return new Response("Stripe webhook is not configured", { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return new Response("Missing Stripe signature", { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;

  try {
    event = getStripeClient().webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    log.error({ error }, "Failed to verify Stripe webhook signature");
    return new Response("Invalid Stripe webhook payload", { status: 400 });
  }

  try {
    await processStripeWebhookEvent(event);
    return Response.json({ received: true });
  } catch (error) {
    log.error({ error }, "Failed to process Stripe webhook event");
    return new Response("Stripe webhook processing failed", { status: 500 });
  }
}
