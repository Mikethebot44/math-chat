import { z } from "zod";
import { createApiKey, maskApiKey } from "@/lib/api/api-key";
import { getUserApiKeyByUserId, upsertUserApiKey } from "@/lib/db/api-access";
import { getCredits } from "@/lib/db/credits";
import {
  getUserModelPreferences,
  upsertUserModelPreference,
} from "@/lib/db/queries";
import {
  getUserPreferences,
  upsertUserPreferences,
} from "@/lib/db/user-preferences";
import {
  normalizeUserPreferences,
  userPreferencesInputSchema,
} from "@/lib/settings/user-preferences";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";

export const settingsRouter = createTRPCRouter({
  getApiAccess: protectedProcedure.query(async ({ ctx }) => {
    const [credits, apiKey] = await Promise.all([
      getCredits(ctx.user.id),
      getUserApiKeyByUserId({ userId: ctx.user.id }),
    ]);

    return {
      credits,
      hasKey: apiKey !== null,
      maskedKey: apiKey
        ? maskApiKey({
            keyPrefix: apiKey.keyPrefix,
            keySuffix: apiKey.keySuffix,
          })
        : null,
      createdAt: apiKey?.createdAt ?? null,
      lastUsedAt: apiKey?.lastUsedAt ?? null,
      rotatedAt: apiKey?.rotatedAt ?? null,
    };
  }),

  rotateApiKey: protectedProcedure.mutation(async ({ ctx }) => {
    const generatedKey = createApiKey();

    const savedKey = await upsertUserApiKey({
      userId: ctx.user.id,
      keyHash: generatedKey.keyHash,
      keyPrefix: generatedKey.keyPrefix,
      keySuffix: generatedKey.keySuffix,
    });

    const credits = await getCredits(ctx.user.id);

    return {
      apiKey: generatedKey.plaintext,
      credits,
      hasKey: true,
      maskedKey: maskApiKey({
        keyPrefix: savedKey.keyPrefix,
        keySuffix: savedKey.keySuffix,
      }),
      createdAt: savedKey.createdAt,
      lastUsedAt: savedKey.lastUsedAt,
      rotatedAt: savedKey.rotatedAt,
    };
  }),

  getGeneralPreferences: protectedProcedure.query(async ({ ctx }) =>
    getUserPreferences({ userId: ctx.user.id })
  ),

  updateGeneralPreferences: protectedProcedure
    .input(userPreferencesInputSchema)
    .mutation(async ({ ctx, input }) =>
      upsertUserPreferences({
        userId: ctx.user.id,
        preferences: normalizeUserPreferences(input),
      })
    ),

  getModelPreferences: protectedProcedure.query(
    async ({ ctx }) => await getUserModelPreferences({ userId: ctx.user.id })
  ),

  setModelEnabled: protectedProcedure
    .input(
      z.object({
        modelId: z.string(),
        enabled: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await upsertUserModelPreference({
        userId: ctx.user.id,
        modelId: input.modelId,
        enabled: input.enabled,
      });
      return { success: true };
    }),
});
