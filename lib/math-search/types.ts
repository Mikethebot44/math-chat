import { z } from "zod";

export const mathSearchQuerySchema = z.object({
  query: z.string().min(2).max(500),
});

export const mathSearchResultSchema = z.object({
  abstract: z.string(),
  authors: z.array(z.string()),
  id: z.string(),
  publishedDate: z.string().nullable(),
  source: z.literal("paper"),
  title: z.string().min(1),
  url: z.string().url(),
});

export const mathSearchExampleEntrySchema = z.object({
  query: z.string().min(2),
  results: z.array(mathSearchResultSchema),
});

export const MATH_SEARCH_EXAMPLE_QUERIES = [
  "compact manifolds",
  "fundamental group",
  "cohomology ring",
] as const;

export interface MathSearchResult
  extends z.infer<typeof mathSearchResultSchema> {}

export interface MathSearchExampleEntry
  extends z.infer<typeof mathSearchExampleEntrySchema> {}
