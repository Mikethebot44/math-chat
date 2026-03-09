import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { searchMath } from "./search";
import {
  MATH_SEARCH_EXAMPLE_QUERIES,
  type MathSearchExampleEntry,
  mathSearchExampleEntrySchema,
} from "./types";

const cacheFileSchema = z.object({
  examples: z.array(mathSearchExampleEntrySchema),
  generatedAt: z.string(),
});

const CACHE_FILE_PATH = path.join(
  process.cwd(),
  "data",
  "math-search-example-cache.json"
);

const getRenderableExampleSearches = (
  examples: MathSearchExampleEntry[]
): MathSearchExampleEntry[] => {
  const examplesWithResults = examples.filter(
    (exampleSearch) => exampleSearch.results.length > 0
  );

  if (examplesWithResults.length >= 2) {
    return examplesWithResults;
  }

  return examples;
};

export const getMathSearchExampleCacheFilePath = (): string => CACHE_FILE_PATH;

export const readMathSearchExampleCache = async (): Promise<
  MathSearchExampleEntry[] | null
> => {
  try {
    const fileContents = await readFile(CACHE_FILE_PATH, "utf8");
    const parsed = cacheFileSchema.parse(JSON.parse(fileContents));
    return getRenderableExampleSearches(parsed.examples);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }

    console.warn("[math-search] failed to read example cache file", {
      error: error instanceof Error ? error.message : error,
    });
    return null;
  }
};

export const writeMathSearchExampleCache = async (
  examples: MathSearchExampleEntry[]
): Promise<void> => {
  await mkdir(path.dirname(CACHE_FILE_PATH), { recursive: true });
  await writeFile(
    CACHE_FILE_PATH,
    JSON.stringify(
      {
        examples,
        generatedAt: new Date().toISOString(),
      },
      null,
      2
    ),
    "utf8"
  );
};

export const buildMathSearchExampleCache = async (): Promise<
  MathSearchExampleEntry[]
> => {
  const examples = await Promise.all(
    MATH_SEARCH_EXAMPLE_QUERIES.map(async (query) => ({
      query,
      results: await searchMath(query),
    }))
  );

  const renderableExamples = getRenderableExampleSearches(examples);
  await writeMathSearchExampleCache(renderableExamples);
  return renderableExamples;
};

export const getMathSearchExampleCache = async (): Promise<
  MathSearchExampleEntry[]
> => {
  const cachedExamples = await readMathSearchExampleCache();
  if (cachedExamples && cachedExamples.length > 0) {
    return cachedExamples;
  }

  return buildMathSearchExampleCache();
};
