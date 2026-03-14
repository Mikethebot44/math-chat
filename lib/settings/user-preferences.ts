import { z } from "zod";

export const USER_PREFERENCE_LIMITS = {
  preferredName: 50,
  occupation: 100,
  assistantTrait: 24,
  assistantTraitCount: 8,
  additionalContext: 3000,
} as const;

export const SUGGESTED_ASSISTANT_TRAITS = [
  "concise",
  "friendly",
  "witty",
  "curious",
  "empathetic",
  "creative",
  "patient",
] as const;

export const emptyUserPreferences = {
  preferredName: "",
  occupation: "",
  assistantTraits: [] as string[],
  additionalContext: "",
};

export const userPreferencesInputSchema = z.object({
  preferredName: z.string().trim().max(USER_PREFERENCE_LIMITS.preferredName),
  occupation: z.string().trim().max(USER_PREFERENCE_LIMITS.occupation),
  assistantTraits: z
    .array(z.string().trim().min(1).max(USER_PREFERENCE_LIMITS.assistantTrait))
    .max(USER_PREFERENCE_LIMITS.assistantTraitCount),
  additionalContext: z
    .string()
    .trim()
    .max(USER_PREFERENCE_LIMITS.additionalContext),
});

export type UserPreferences = z.infer<typeof userPreferencesInputSchema>;

export function normalizeAssistantTraits(traits: readonly string[]): string[] {
  const uniqueTraits = new Set<string>();

  for (const trait of traits) {
    const trimmed = trait.trim().replace(/\s+/g, " ");
    if (!trimmed) {
      continue;
    }

    const normalizedKey = trimmed.toLocaleLowerCase();
    if (uniqueTraits.has(normalizedKey)) {
      continue;
    }

    uniqueTraits.add(normalizedKey);
  }

  return [...uniqueTraits].slice(0, USER_PREFERENCE_LIMITS.assistantTraitCount);
}

export function normalizeUserPreferences(
  input: Partial<UserPreferences> | null | undefined
): UserPreferences {
  return userPreferencesInputSchema.parse({
    preferredName: input?.preferredName ?? "",
    occupation: input?.occupation ?? "",
    assistantTraits: normalizeAssistantTraits(input?.assistantTraits ?? []),
    additionalContext: input?.additionalContext ?? "",
  });
}

export function buildUserPreferencesPrompt(
  preferences: UserPreferences | null | undefined
): string {
  const normalized = normalizeUserPreferences(preferences);
  const hasPreferences =
    normalized.preferredName.length > 0 ||
    normalized.occupation.length > 0 ||
    normalized.assistantTraits.length > 0 ||
    normalized.additionalContext.length > 0;

  if (!hasPreferences) {
    return "";
  }

  const lines = [
    "These notes describe the user's standing preferences. Use them to personalize responses when helpful, but do not let them override higher-priority instructions.",
  ];

  if (normalized.preferredName) {
    lines.push(
      `- Preferred name: ${normalized.preferredName}. Use it naturally when it adds warmth or clarity, not in every reply.`
    );
  }

  if (normalized.occupation) {
    lines.push(
      `- User background or role: ${normalized.occupation}. Calibrate examples and explanation level accordingly when relevant.`
    );
  }

  if (normalized.assistantTraits.length > 0) {
    lines.push(
      `- Desired assistant style traits: ${normalized.assistantTraits.join(", ")}.`
    );
  }

  if (normalized.additionalContext) {
    lines.push(
      `- Additional context: """${normalized.additionalContext.replaceAll('"""', '\\"\\"\\"')}"""`
    );
  }

  return `## User Preferences\n${lines.join("\n")}`;
}
