import { z } from "zod";

export const mathSearchQuerySchema = z.object({
  query: z.string().min(2).max(500),
});

export const mathSearchResultSchema = z.object({
  id: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  rerankScore: z.number(),
  source: z.enum(["paper", "theorem"]),
  vectorScore: z.number(),
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
