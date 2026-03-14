import "server-only";

import { type MathSearchResult, mathSearchResultSchema } from "./types";

interface ExaSearchResponse {
  results?: ExaSearchResult[];
}

interface ExaSearchResult {
  abstract?: string;
  author?: unknown;
  authors?: unknown;
  highlights?: unknown;
  id?: string;
  publishedDate?: string | null;
  summary?: string;
  text?: string;
  title?: string;
  url?: string;
}

const EXA_SEARCH_ENDPOINT = "https://api.exa.ai/search";
const MAX_RESULTS = 8;
const ABSTRACT_PATTERN = /(?:^|\n)\s*abstract[:\s-]+([\s\S]{80,2400})/i;
const AUTHOR_SPLIT_PATTERN = /,| and /i;
const PARAGRAPH_SPLIT_PATTERN = /\n\s*\n/;

const decodeHtmlEntities = (text: string): string =>
  text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const normalizeWhitespace = (text: string): string =>
  text.replace(/\s+/g, " ").trim();

const sanitizeText = (text: string): string =>
  normalizeWhitespace(decodeHtmlEntities(text.replace(/<[^>]+>/g, " ")));

const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}...`;
};

const getString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const sanitized = sanitizeText(value);
  return sanitized.length > 0 ? sanitized : null;
};

const normalizeAuthors = (authors: unknown, author: unknown): string[] => {
  const source = authors ?? author;

  if (typeof source === "string") {
    return source
      .split(AUTHOR_SPLIT_PATTERN)
      .map((name) => name.trim())
      .filter(Boolean);
  }

  if (!Array.isArray(source)) {
    return [];
  }

  return source
    .map((entry) => {
      if (typeof entry === "string") {
        return entry.trim();
      }

      if (
        entry &&
        typeof entry === "object" &&
        "name" in entry &&
        typeof entry.name === "string"
      ) {
        return entry.name.trim();
      }

      return null;
    })
    .filter((name): name is string => Boolean(name));
};

const getHighlightsText = (highlights: unknown): string | null => {
  if (!Array.isArray(highlights)) {
    return null;
  }

  const sanitizedHighlights = highlights
    .filter((highlight): highlight is string => typeof highlight === "string")
    .map((highlight) => sanitizeText(highlight))
    .filter(Boolean);

  if (sanitizedHighlights.length === 0) {
    return null;
  }

  return truncateText(sanitizedHighlights.join(" "), 420);
};

const extractAbstractFromText = (text: string): string | null => {
  const normalizedText = decodeHtmlEntities(text.replace(/\r/g, ""));
  const abstractMatch = normalizedText.match(ABSTRACT_PATTERN);
  if (abstractMatch?.[1]) {
    return truncateText(sanitizeText(abstractMatch[1]), 420);
  }

  const paragraphs = normalizedText
    .split(PARAGRAPH_SPLIT_PATTERN)
    .map((paragraph) => sanitizeText(paragraph))
    .filter(
      (paragraph) =>
        paragraph.length > 120 && !paragraph.toLowerCase().startsWith("title:")
    );

  return paragraphs[0] ? truncateText(paragraphs[0], 420) : null;
};

const toMathSearchResult = (
  result: ExaSearchResult
): MathSearchResult | null => {
  const url = getString(result.url);
  if (!url) {
    return null;
  }

  const parsedResult = mathSearchResultSchema.safeParse({
    abstract:
      getString(result.abstract) ??
      getString(result.summary) ??
      getHighlightsText(result.highlights) ??
      (result.text ? extractAbstractFromText(result.text) : null) ??
      "No abstract available.",
    authors: normalizeAuthors(result.authors, result.author),
    id: getString(result.id) ?? url,
    publishedDate: getString(result.publishedDate),
    source: "paper",
    title: getString(result.title) ?? "Untitled paper",
    url,
  });

  return parsedResult.success ? parsedResult.data : null;
};

export const isMathSearchConfigured = (): boolean =>
  !!process.env.EXA_API_KEY?.trim();

export async function searchMath(query: string): Promise<MathSearchResult[]> {
  if (!isMathSearchConfigured()) {
    throw new Error(
      "Math paper search is not configured on the server. Set EXA_API_KEY."
    );
  }

  const response = await fetch(EXA_SEARCH_ENDPOINT, {
    body: JSON.stringify({
      category: "research paper",
      contents: {
        text: true,
      },
      numResults: MAX_RESULTS,
      query,
      type: "auto",
    }),
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.EXA_API_KEY ?? "",
    },
    method: "POST",
  });

  const responseText = await response.text();
  if (!response.ok) {
    console.error("[math-search] Exa search failed", {
      bodyPreview: responseText.slice(0, 500),
      status: response.status,
    });
    throw new Error(`Exa paper search failed (${response.status}).`);
  }

  const payload = JSON.parse(responseText) as ExaSearchResponse;

  return (payload.results ?? [])
    .map((result) => toMathSearchResult(result))
    .filter((result): result is MathSearchResult => result !== null);
}
