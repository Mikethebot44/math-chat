import { z } from "zod";
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
