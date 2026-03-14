import { describe, expect, it } from "vitest";
import {
  buildUserPreferencesPrompt,
  normalizeUserPreferences,
} from "./user-preferences";

describe("user preferences", () => {
  it("normalizes whitespace, trims fields, and deduplicates assistant traits", () => {
    const result = normalizeUserPreferences({
      preferredName: "  Ada  ",
      occupation: "  student ",
      assistantTraits: ["Concise", " concise ", "friendly", ""],
      additionalContext: "  likes examples  ",
    });

    expect(result).toEqual({
      preferredName: "Ada",
      occupation: "student",
      assistantTraits: ["concise", "friendly"],
      additionalContext: "likes examples",
    });
  });

  it("renders a prompt section only when preferences exist", () => {
    expect(buildUserPreferencesPrompt(null)).toBe("");

    const prompt = buildUserPreferencesPrompt({
      preferredName: "Ada",
      occupation: "student",
      assistantTraits: ["concise", "curious"],
      additionalContext: "Prefers direct answers.",
    });

    expect(prompt).toContain("## User Preferences");
    expect(prompt).toContain("Preferred name: Ada");
    expect(prompt).toContain("User background or role: student");
    expect(prompt).toContain("concise, curious");
    expect(prompt).toContain("Prefers direct answers.");
  });
});
