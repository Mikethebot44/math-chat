import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import type { CreditTopUpStatus } from "@/lib/credits/top-up";
import { isTerminalCreditTopUpStatus } from "@/lib/credits/top-up";
import { db } from "./client";
import { creditTopUp, type CreditTopUp, userCredit } from "./schema";

async function ensureUserCreditRow(userId: string) {
  await db.insert(userCredit).values({ userId }).onConflictDoNothing();
}

async function ensureUserCreditRowTx(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string
) {
  await tx.insert(userCredit).values({ userId }).onConflictDoNothing();
}

/**
 * Get user's current credit balance (in cents).
 */
export async function getCredits(userId: string): Promise<number> {
  let rows = await db
    .select({ credits: userCredit.credits })
    .from(userCredit)
    .where(eq(userCredit.userId, userId))
    .limit(1);

  if (rows.length === 0) {
    await ensureUserCreditRow(userId);
    rows = await db
      .select({ credits: userCredit.credits })
      .from(userCredit)
      .where(eq(userCredit.userId, userId))
      .limit(1);
  }

  return rows[0]?.credits ?? 0;
}

/**
 * Check if user has positive credits (can spend).
 */
export async function canSpend(userId: string): Promise<boolean> {
  const credits = await getCredits(userId);
  return credits > 0;
}

/**
 * Deduct credits from user. Allows going slightly negative for in-progress operations.
 */
export async function deductCredits(
  userId: string,
  amount: number
): Promise<void> {
  await ensureUserCreditRow(userId);
  await db
    .update(userCredit)
    .set({
      credits: sql`${userCredit.credits} - ${amount}`,
    })
    .where(eq(userCredit.userId, userId));
}

/**
 * Add credits to user (for purchases, refunds, etc).
 */
export async function addCredits(userId: string, amount: number): Promise<void> {
  await ensureUserCreditRow(userId);
  await db
    .update(userCredit)
    .set({
      credits: sql`${userCredit.credits} + ${amount}`,
    })
    .where(eq(userCredit.userId, userId));
}

export async function createCreditTopUp({
  userId,
  amountCents,
  creditsToAdd,
}: {
  userId: string;
  amountCents: number;
  creditsToAdd: number;
}): Promise<CreditTopUp> {
  const [created] = await db
    .insert(creditTopUp)
    .values({
      amountCents,
      creditsToAdd,
      status: "initiated",
      userId,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create credit top-up");
  }

  return created;
}

export async function attachStripeSessionToCreditTopUp({
  creditTopUpId,
  stripeCheckoutSessionId,
}: {
  creditTopUpId: string;
  stripeCheckoutSessionId: string;
}): Promise<CreditTopUp> {
  const [updated] = await db
    .update(creditTopUp)
    .set({
      status: "pending",
      stripeCheckoutSessionId,
      updatedAt: new Date(),
    })
    .where(eq(creditTopUp.id, creditTopUpId))
    .returning();

  if (!updated) {
    throw new Error("Failed to attach Stripe session to credit top-up");
  }

  return updated;
}

export async function getCreditTopUpForUserBySessionId({
  sessionId,
  userId,
}: {
  sessionId: string;
  userId: string;
}): Promise<CreditTopUp | null> {
  const [topUp] = await db
    .select()
    .from(creditTopUp)
    .where(
      and(
        eq(creditTopUp.stripeCheckoutSessionId, sessionId),
        eq(creditTopUp.userId, userId)
      )
    )
    .limit(1);

  return topUp ?? null;
}

export async function getCreditTopUpByIdOrStripeSessionId({
  creditTopUpId,
  stripeCheckoutSessionId,
}: {
  creditTopUpId?: string;
  stripeCheckoutSessionId?: string;
}): Promise<CreditTopUp | null> {
  if (!(creditTopUpId || stripeCheckoutSessionId)) {
    return null;
  }

  const [topUp] = await db
    .select()
    .from(creditTopUp)
    .where(
      or(
        creditTopUpId ? eq(creditTopUp.id, creditTopUpId) : undefined,
        stripeCheckoutSessionId
          ? eq(creditTopUp.stripeCheckoutSessionId, stripeCheckoutSessionId)
          : undefined
      )
    )
    .limit(1);

  return topUp ?? null;
}

export async function listCreditTopUpsForUser({
  userId,
  limit = 10,
}: {
  userId: string;
  limit?: number;
}): Promise<CreditTopUp[]> {
  return db
    .select()
    .from(creditTopUp)
    .where(eq(creditTopUp.userId, userId))
    .orderBy(desc(creditTopUp.createdAt))
    .limit(limit);
}

export async function markCreditTopUpCompletedAndAddCredits({
  creditTopUpId,
  stripeCheckoutSessionId,
  stripePaymentIntentId,
}: {
  creditTopUpId?: string;
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string | null;
}): Promise<CreditTopUp | null> {
  return db.transaction(async (tx) => {
    const topUp = await getCreditTopUpRowForUpdate(tx, {
      creditTopUpId,
      stripeCheckoutSessionId,
    });

    if (!topUp) {
      return null;
    }

    if (topUp.status === "completed") {
      return topUp;
    }

    if (topUp.status !== "initiated" && topUp.status !== "pending") {
      return topUp;
    }

    await ensureUserCreditRowTx(tx, topUp.userId);

    const [updated] = await tx
      .update(creditTopUp)
      .set({
        completedAt: new Date(),
        status: "completed",
        stripeCheckoutSessionId:
          stripeCheckoutSessionId ?? topUp.stripeCheckoutSessionId,
        stripePaymentIntentId:
          stripePaymentIntentId ?? topUp.stripePaymentIntentId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(creditTopUp.id, topUp.id),
          inArray(creditTopUp.status, ["initiated", "pending"])
        )
      )
      .returning();

    const resolvedTopUp = updated ?? topUp;

    if (!updated) {
      return resolvedTopUp;
    }

    await tx
      .update(userCredit)
      .set({
        credits: sql`${userCredit.credits} + ${resolvedTopUp.creditsToAdd}`,
      })
      .where(eq(userCredit.userId, resolvedTopUp.userId));

    return resolvedTopUp;
  });
}

export async function markCreditTopUpExpired({
  creditTopUpId,
  stripeCheckoutSessionId,
}: {
  creditTopUpId?: string;
  stripeCheckoutSessionId?: string;
}): Promise<CreditTopUp | null> {
  return markCreditTopUpWithTerminalStatus({
    creditTopUpId,
    failureReason: null,
    nextStatus: "expired",
    stripeCheckoutSessionId,
  });
}

export async function markCreditTopUpFailed({
  creditTopUpId,
  stripeCheckoutSessionId,
  failureReason,
}: {
  creditTopUpId?: string;
  stripeCheckoutSessionId?: string;
  failureReason: string;
}): Promise<CreditTopUp | null> {
  return markCreditTopUpWithTerminalStatus({
    creditTopUpId,
    failureReason,
    nextStatus: "failed",
    stripeCheckoutSessionId,
  });
}

async function markCreditTopUpWithTerminalStatus({
  creditTopUpId,
  stripeCheckoutSessionId,
  nextStatus,
  failureReason,
}: {
  creditTopUpId?: string;
  stripeCheckoutSessionId?: string;
  nextStatus: Extract<CreditTopUpStatus, "expired" | "failed">;
  failureReason: string | null;
}): Promise<CreditTopUp | null> {
  return db.transaction(async (tx) => {
    const topUp = await getCreditTopUpRowForUpdate(tx, {
      creditTopUpId,
      stripeCheckoutSessionId,
    });

    if (!topUp) {
      return null;
    }

    if (isTerminalCreditTopUpStatus(topUp.status as CreditTopUpStatus)) {
      return topUp;
    }

    const [updated] = await tx
      .update(creditTopUp)
      .set({
        failureReason,
        status: nextStatus,
        updatedAt: new Date(),
      })
      .where(eq(creditTopUp.id, topUp.id))
      .returning();

    return updated ?? topUp;
  });
}

async function getCreditTopUpRowForUpdate(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  {
    creditTopUpId,
    stripeCheckoutSessionId,
  }: {
    creditTopUpId?: string;
    stripeCheckoutSessionId?: string;
  }
): Promise<CreditTopUp | null> {
  if (!(creditTopUpId || stripeCheckoutSessionId)) {
    return null;
  }

  const [topUp] = await tx
    .select()
    .from(creditTopUp)
    .where(
      or(
        creditTopUpId ? eq(creditTopUp.id, creditTopUpId) : undefined,
        stripeCheckoutSessionId
          ? eq(creditTopUp.stripeCheckoutSessionId, stripeCheckoutSessionId)
          : undefined
      )
    )
    .limit(1);

  return topUp ?? null;
}
