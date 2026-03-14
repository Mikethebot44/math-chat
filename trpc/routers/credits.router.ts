import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  CREDIT_TOP_UP_CURRENCY,
  MIN_CREDIT_TOP_UP_DOLLARS,
  isValidTopUpAmountDollars,
  topUpAmountDollarsToCents,
} from "@/lib/credits/top-up";
import {
  attachStripeSessionToCreditTopUp,
  createCreditTopUp,
  getCreditTopUpForUserBySessionId,
  getCredits,
  listCreditTopUpsForUser,
  markCreditTopUpFailed,
} from "@/lib/db/credits";
import { config } from "@/lib/config";
import { createModuleLogger } from "@/lib/logger";
import { getStripeClient, isStripeConfigured } from "@/lib/stripe/server";
import { reconcileStripeCheckoutSession } from "@/lib/stripe/webhook";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

const log = createModuleLogger("credits.router");

function toLoggableError(error: unknown) {
  if (error instanceof Error) {
    return {
      cause: error.cause,
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  return error;
}

async function reconcileStripeCheckoutSessionForRead({
  sessionId,
  userId,
}: {
  sessionId: string;
  userId: string;
}) {
  try {
    await reconcileStripeCheckoutSession(sessionId);
  } catch (error) {
    log.warn(
      {
        error: toLoggableError(error),
        sessionId,
        userId,
      },
      "Stripe checkout reconciliation failed during billing read"
    );
  }
}

export const creditsRouter = createTRPCRouter({
  getAvailableCredits: protectedProcedure.query(async ({ ctx }) => {
    const credits = await getCredits(ctx.user.id);
    return { credits };
  }),

  getBillingOverview: protectedProcedure.query(async ({ ctx }) => {
    let [currentCredits, recentTopUps] = await Promise.all([
      getCredits(ctx.user.id),
      listCreditTopUpsForUser({ userId: ctx.user.id }),
    ]);

    if (isStripeConfigured()) {
      const pendingTopUps = recentTopUps
        .filter(
          (topUp) =>
            (topUp.status === "initiated" || topUp.status === "pending") &&
            topUp.stripeCheckoutSessionId
        )
        .slice(0, 3);

      if (pendingTopUps.length > 0) {
        await Promise.all(
          pendingTopUps.map((topUp) =>
            reconcileStripeCheckoutSessionForRead({
              sessionId: topUp.stripeCheckoutSessionId!,
              userId: ctx.user.id,
            })
          )
        );

        [currentCredits, recentTopUps] = await Promise.all([
          getCredits(ctx.user.id),
          listCreditTopUpsForUser({ userId: ctx.user.id }),
        ]);
      }
    }

    return {
      currentCredits,
      recentTopUps,
      stripeConfigured: isStripeConfigured(),
    };
  }),

  getTopUpStatus: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      let topUp = await getCreditTopUpForUserBySessionId({
        sessionId: input.sessionId,
        userId: ctx.user.id,
      });

      if (
        topUp &&
        isStripeConfigured() &&
        (topUp.status === "initiated" || topUp.status === "pending")
      ) {
        await reconcileStripeCheckoutSessionForRead({
          sessionId: input.sessionId,
          userId: ctx.user.id,
        });
        topUp = await getCreditTopUpForUserBySessionId({
          sessionId: input.sessionId,
          userId: ctx.user.id,
        });
      }

      if (!topUp) {
        return null;
      }

      return {
        amountCents: topUp.amountCents,
        completedAt: topUp.completedAt,
        createdAt: topUp.createdAt,
        creditsToAdd: topUp.creditsToAdd,
        failureReason: topUp.failureReason,
        id: topUp.id,
        status: topUp.status,
      };
    }),

  createTopUpCheckoutSession: protectedProcedure
    .input(
      z.object({
        amountDollars: z
          .number()
          .positive()
          .refine(isValidTopUpAmountDollars, {
            message: `Amount must be at least $${MIN_CREDIT_TOP_UP_DOLLARS.toFixed(2)} and use whole cents`,
          }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!isStripeConfigured()) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Stripe billing is not configured",
        });
      }

      const stripe = getStripeClient();
      const amountCents = topUpAmountDollarsToCents(input.amountDollars);
      const creditsToAdd = amountCents;

      const topUp = await createCreditTopUp({
        amountCents,
        creditsToAdd,
        userId: ctx.user.id,
      });

      try {
        const session = await stripe.checkout.sessions.create({
          cancel_url: `${config.appUrl}/settings/billing?checkout=cancelled`,
          client_reference_id: ctx.user.id,
          customer_email: ctx.user.email || undefined,
          line_items: [
            {
              price_data: {
                currency: CREDIT_TOP_UP_CURRENCY,
                product_data: {
                  description: `${creditsToAdd} credits`,
                  name: `${config.appName} credit top-up`,
                },
                unit_amount: amountCents,
              },
              quantity: 1,
            },
          ],
          metadata: {
            creditTopUpId: topUp.id,
            creditsToAdd: String(creditsToAdd),
            userId: ctx.user.id,
          },
          mode: "payment",
          success_url: `${config.appUrl}/settings/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        });

        if (!session.id || !session.url) {
          throw new Error("Stripe Checkout session did not return a URL");
        }

        await attachStripeSessionToCreditTopUp({
          creditTopUpId: topUp.id,
          stripeCheckoutSessionId: session.id,
        });

        return { url: session.url };
      } catch (error) {
        await markCreditTopUpFailed({
          creditTopUpId: topUp.id,
          failureReason: "stripe_checkout_session_creation_failed",
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          cause: error,
          message: "Failed to create Stripe Checkout session",
        });
      }
    }),
});
