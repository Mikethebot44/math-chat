import { eq } from "drizzle-orm";
import { cache } from "react";
import {
  emptyUserPreferences,
  normalizeUserPreferences,
  type UserPreferences,
} from "@/lib/settings/user-preferences";
import { db } from "./client";
import { userPreference } from "./schema";

const getUserPreferencesCached = cache(async (userId: string) => {
  const [preferences] = await db
    .select({
      preferredName: userPreference.preferredName,
      occupation: userPreference.occupation,
      assistantTraits: userPreference.assistantTraits,
      additionalContext: userPreference.additionalContext,
    })
    .from(userPreference)
    .where(eq(userPreference.userId, userId))
    .limit(1);

  if (!preferences) {
    return emptyUserPreferences;
  }

  return normalizeUserPreferences({
    preferredName: preferences.preferredName ?? "",
    occupation: preferences.occupation ?? "",
    assistantTraits: preferences.assistantTraits,
    additionalContext: preferences.additionalContext ?? "",
  });
});

export async function getUserPreferences({
  userId,
}: {
  userId: string;
}): Promise<UserPreferences> {
  return getUserPreferencesCached(userId);
}

export async function upsertUserPreferences({
  userId,
  preferences,
}: {
  userId: string;
  preferences: UserPreferences;
}): Promise<UserPreferences> {
  const normalized = normalizeUserPreferences(preferences);

  await db
    .insert(userPreference)
    .values({
      userId,
      preferredName: normalized.preferredName || null,
      occupation: normalized.occupation || null,
      assistantTraits: normalized.assistantTraits,
      additionalContext: normalized.additionalContext || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userPreference.userId,
      set: {
        preferredName: normalized.preferredName || null,
        occupation: normalized.occupation || null,
        assistantTraits: normalized.assistantTraits,
        additionalContext: normalized.additionalContext || null,
        updatedAt: new Date(),
      },
    });

  return normalized;
}
