import { and, eq, sql } from "drizzle-orm";
import { db } from "./client";
import { apiCompletion, userApiKey, type ApiCompletion } from "./schema";

export async function getUserApiKeyByUserId({
  userId,
}: {
  userId: string;
}) {
  const [row] = await db
    .select()
    .from(userApiKey)
    .where(eq(userApiKey.userId, userId))
    .limit(1);

  return row ?? null;
}

export async function getUserApiKeyByHash({
  keyHash,
}: {
  keyHash: string;
}) {
  const [row] = await db
    .select()
    .from(userApiKey)
    .where(eq(userApiKey.keyHash, keyHash))
    .limit(1);

  return row ?? null;
}

export async function upsertUserApiKey({
  userId,
  keyHash,
  keyPrefix,
  keySuffix,
}: {
  userId: string;
  keyHash: string;
  keyPrefix: string;
  keySuffix: string;
}) {
  const [row] = await db
    .insert(userApiKey)
    .values({
      userId,
      keyHash,
      keyPrefix,
      keySuffix,
      createdAt: new Date(),
      rotatedAt: new Date(),
      lastUsedAt: null,
    })
    .onConflictDoUpdate({
      target: userApiKey.userId,
      set: {
        keyHash,
        keyPrefix,
        keySuffix,
        rotatedAt: new Date(),
        lastUsedAt: null,
      },
    })
    .returning();

  if (!row) {
    throw new Error("Failed to upsert user API key");
  }

  return row;
}

export async function touchUserApiKeyLastUsedAt({
  userId,
}: {
  userId: string;
}) {
  await db
    .update(userApiKey)
    .set({ lastUsedAt: new Date() })
    .where(eq(userApiKey.userId, userId));
}

export async function createApiCompletion({
  id,
  userId,
  model,
  requestMessages,
}: {
  id: string;
  model: string;
  requestMessages: unknown;
  userId: string;
}) {
  const [row] = await db
    .insert(apiCompletion)
    .values({
      id,
      userId,
      model,
      requestMessages,
      status: "queued",
    })
    .returning();

  if (!row) {
    throw new Error("Failed to create API completion");
  }

  return row;
}

export async function getApiCompletionByIdForUser({
  id,
  userId,
}: {
  id: string;
  userId: string;
}) {
  const [row] = await db
    .select()
    .from(apiCompletion)
    .where(and(eq(apiCompletion.id, id), eq(apiCompletion.userId, userId)))
    .limit(1);

  return row ?? null;
}

export async function finalizeApiCompletionStart({
  id,
  userId,
  status,
  aristotleJobId = null,
  creditsCharged,
  errorCode = null,
  errorMessage = null,
  leanFileContent = null,
  leanFileName = null,
  responseText = null,
  usageCompletionTokens,
  usagePromptTokens,
}: {
  aristotleJobId?: string | null;
  creditsCharged: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  id: string;
  leanFileContent?: string | null;
  leanFileName?: string | null;
  responseText?: string | null;
  status: "completed" | "failed" | "in_progress";
  usageCompletionTokens: number;
  usagePromptTokens: number;
  userId: string;
}) {
  const [row] = await db
    .update(apiCompletion)
    .set({
      aristotleJobId,
      completedAt: status === "completed" || status === "failed" ? new Date() : null,
      creditsCharged,
      errorCode,
      errorMessage,
      leanFileContent,
      leanFileName,
      responseText,
      status,
      usageCompletionTokens,
      usagePromptTokens,
      updatedAt: new Date(),
    })
    .where(and(eq(apiCompletion.id, id), eq(apiCompletion.userId, userId)))
    .returning();

  if (!row) {
    throw new Error("Failed to update API completion");
  }

  return row;
}

export async function beginApiCompletionFinalization({
  id,
  userId,
}: {
  id: string;
  userId: string;
}) {
  const [row] = await db
    .update(apiCompletion)
    .set({
      status: "finalizing",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(apiCompletion.id, id),
        eq(apiCompletion.userId, userId),
        eq(apiCompletion.status, "in_progress")
      )
    )
    .returning();

  return row ?? null;
}

export async function completeApiCompletionAfterFinalization({
  id,
  userId,
  responseText,
  leanFileName,
  leanFileContent,
  usagePromptTokens,
  usageCompletionTokens,
  creditsCharged,
}: {
  creditsCharged: number;
  id: string;
  leanFileContent: string | null;
  leanFileName: string | null;
  responseText: string;
  usageCompletionTokens: number;
  usagePromptTokens: number;
  userId: string;
}) {
  const [row] = await db
    .update(apiCompletion)
    .set({
      status: "completed",
      completedAt: new Date(),
      responseText,
      leanFileName,
      leanFileContent,
      creditsCharged: sql`${apiCompletion.creditsCharged} + ${creditsCharged}`,
      usagePromptTokens: sql`coalesce(${apiCompletion.usagePromptTokens}, 0) + ${usagePromptTokens}`,
      usageCompletionTokens: sql`coalesce(${apiCompletion.usageCompletionTokens}, 0) + ${usageCompletionTokens}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(apiCompletion.id, id),
        eq(apiCompletion.userId, userId),
        eq(apiCompletion.status, "finalizing")
      )
    )
    .returning();

  return row ?? null;
}

export async function failApiCompletionAfterFinalization({
  id,
  userId,
  responseText,
  errorCode,
  errorMessage,
  usagePromptTokens,
  usageCompletionTokens,
  creditsCharged,
}: {
  creditsCharged: number;
  errorCode: string;
  errorMessage: string;
  id: string;
  responseText: string;
  usageCompletionTokens: number;
  usagePromptTokens: number;
  userId: string;
}) {
  const [row] = await db
    .update(apiCompletion)
    .set({
      status: "failed",
      completedAt: new Date(),
      responseText,
      errorCode,
      errorMessage,
      creditsCharged: sql`${apiCompletion.creditsCharged} + ${creditsCharged}`,
      usagePromptTokens: sql`coalesce(${apiCompletion.usagePromptTokens}, 0) + ${usagePromptTokens}`,
      usageCompletionTokens: sql`coalesce(${apiCompletion.usageCompletionTokens}, 0) + ${usageCompletionTokens}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(apiCompletion.id, id),
        eq(apiCompletion.userId, userId),
        eq(apiCompletion.status, "finalizing")
      )
    )
    .returning();

  return row ?? null;
}

export function isApiCompletionTerminalStatus(status: ApiCompletion["status"]) {
  return status === "completed" || status === "failed";
}
