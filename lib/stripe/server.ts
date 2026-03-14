import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";

let stripeClient: Stripe | null = null;

export function getStripeKeyMode(): "live" | "test" | "unknown" {
  if (env.STRIPE_SECRET_KEY?.startsWith("sk_live_")) {
    return "live";
  }

  if (env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
    return "test";
  }

  return "unknown";
}

export function getStripeClient(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  if (stripeClient) {
    return stripeClient;
  }

  stripeClient = new Stripe(env.STRIPE_SECRET_KEY);
  return stripeClient;
}

export function isStripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
}
