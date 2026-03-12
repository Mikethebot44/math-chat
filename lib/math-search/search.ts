import "server-only";

import type { MathSearchResult } from "./types";

type SourceType = MathSearchResult["source"];

interface PineconeMatch {
  id: string;
  metadata?: Record<string, unknown>;
  score?: number;
}

interface SearchCandidate {
  id: string;
  metadata: Record<string, unknown>;
  source: SourceType;
  vectorScore: number;
}

interface RankedResult extends SearchCandidate {
  rerankScore: number;
}

const vectorSearchEmbeddingModel =
  process.env.MATH_SEARCH_VECTOR_MODEL ?? "Qwen/Qwen3-Embedding-4B";

const rerankEmbeddingModel =
  process.env.MATH_SEARCH_RERANK_MODEL ?? "Qwen/Qwen3-Embedding-8B";

const vectorDatabases: Array<{ host: string | undefined; source: SourceType }> =
  [
    { host: process.env.PINECONE_PAPERS_HOST, source: "paper" },
    { host: process.env.PINECONE_THEOREMS_HOST, source: "theorem" },
  ];

const embedWithDeepInfra = async (
  input: string | string[],
  model: string,
  dimensions?: number
): Promise<number[][]> => {
  const response = await fetch(
    "https://api.deepinfra.com/v1/openai/embeddings",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DEEPINFRA_API_KEY}`,
      },
      body: JSON.stringify({
        ...(dimensions ? { dimensions } : {}),
        input,
        model,
      }),
    }
  );

  const responseText = await response.text();
  if (!response.ok) {
    console.error("[math-search] DeepInfra embedding request failed", {
      bodyPreview: responseText.slice(0, 500),
      inputCount: Array.isArray(input) ? input.length : 1,
      inputPreview: Array.isArray(input)
        ? input.slice(0, 2).map((item) => item.slice(0, 120))
        : input.slice(0, 120),
      dimensions,
      model,
      status: response.status,
    });
    throw new Error(`Embedding request failed (${response.status})`);
  }

  const payload = JSON.parse(responseText) as {
    data: Array<{ embedding: number[] }>;
  };

  return payload.data.map((item) => item.embedding);
};

const describePineconeIndex = async (
  host: string
): Promise<{ dimension?: number }> => {
  const response = await fetch(`${host}/describe_index_stats`, {
    method: "POST",
    headers: {
      "Api-Key": process.env.PINECONE_API_KEY ?? "",
      "Content-Type": "application/json",
      "X-Pinecone-API-Version": "2024-07",
    },
    body: JSON.stringify({}),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(
      `Pinecone describe_index_stats failed (${response.status}): ${responseText.slice(0, 300)}`
    );
  }

  return JSON.parse(responseText) as { dimension?: number };
};

const queryPinecone = async (
  host: string,
  vector: number[],
  topK = 12,
  source?: SourceType
): Promise<PineconeMatch[]> => {
  const response = await fetch(`${host}/query`, {
    method: "POST",
    headers: {
      "Api-Key": process.env.PINECONE_API_KEY ?? "",
      "Content-Type": "application/json",
      "X-Pinecone-API-Version": "2024-07",
    },
    body: JSON.stringify({
      vector,
      topK,
      includeMetadata: true,
      includeValues: false,
    }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    console.error("[math-search] Pinecone query failed", {
      bodyPreview: responseText.slice(0, 500),
      host,
      source,
      status: response.status,
      topK,
      vectorLength: vector.length,
    });
    throw new Error(
      `Pinecone query failed (${response.status}): ${responseText.slice(0, 300)}`
    );
  }

  const payload = JSON.parse(responseText) as { matches?: PineconeMatch[] };
  return payload.matches ?? [];
};

const toDocumentText = (metadata: Record<string, unknown>): string => {
  const preferredKeys = [
    "title",
    "abstract",
    "text",
    "content",
    "body",
    "question",
    "answer",
    "summary",
  ];

  const orderedValues = preferredKeys
    .map((key) => metadata[key])
    .filter(
      (value) => typeof value === "string" && value.trim().length > 0
    ) as string[];

  if (orderedValues.length > 0) {
    return orderedValues.join("\n\n").slice(0, 4000);
  }

  return JSON.stringify(metadata).slice(0, 4000);
};

const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length !== b.length || a.length === 0) {
    return -1;
  }

  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aNorm += a[i] * a[i];
    bNorm += b[i] * b[i];
  }

  const norm = Math.sqrt(aNorm) * Math.sqrt(bNorm);
  return norm === 0 ? -1 : dot / norm;
};

export const isMathSearchConfigured = (): boolean =>
  !!(
    process.env.DEEPINFRA_API_KEY &&
    process.env.PINECONE_API_KEY &&
    vectorDatabases.every((db) => db.host)
  );

export async function searchMath(query: string): Promise<MathSearchResult[]> {
  if (!isMathSearchConfigured()) {
    throw new Error("Math search is not configured on the server.");
  }

  const indexStats = await Promise.all(
    vectorDatabases.map(async (db) => ({
      source: db.source,
      stats: await describePineconeIndex(db.host ?? ""),
    }))
  );

  const vectorDimension = indexStats.find(
    ({ stats }) => typeof stats.dimension === "number"
  )?.stats.dimension;

  console.info("[math-search] resolved vector embedding settings", {
    indexDimensions: indexStats.map(({ source, stats }) => ({
      dimension: stats.dimension,
      source,
    })),
    vectorDimension,
    vectorSearchEmbeddingModel,
  });

  const inconsistentDimensions = indexStats.some(
    ({ stats }) =>
      typeof stats.dimension === "number" &&
      typeof vectorDimension === "number" &&
      stats.dimension !== vectorDimension
  );

  if (inconsistentDimensions) {
    throw new Error(
      "Math search indexes do not share the same vector dimension. All Pinecone indexes queried by math search must use the same embedding size."
    );
  }

  const [queryEmbedding4B] = await embedWithDeepInfra(
    query,
    vectorSearchEmbeddingModel,
    vectorDimension
  );

  const dimensionMismatch = indexStats.find(
    ({ stats }) =>
      stats.dimension && stats.dimension !== queryEmbedding4B.length
  );

  if (dimensionMismatch) {
    throw new Error(
      `Math search embedding dimension mismatch: ${vectorSearchEmbeddingModel} returned ${queryEmbedding4B.length} dimensions, but the ${dimensionMismatch.source} index expects ${dimensionMismatch.stats.dimension}.`
    );
  }

  const [queryEmbedding8B] = await embedWithDeepInfra(
    query,
    rerankEmbeddingModel
  );

  const searchResponses = await Promise.all(
    vectorDatabases.map(async (db) => {
      const matches = await queryPinecone(
        db.host ?? "",
        queryEmbedding4B,
        12,
        db.source
      );
      return matches.map(
        (match): SearchCandidate => ({
          id: match.id,
          metadata: match.metadata ?? {},
          source: db.source,
          vectorScore: match.score ?? 0,
        })
      );
    })
  );

  const candidates = searchResponses.flat();

  if (candidates.length === 0) {
    return [];
  }

  const docs = candidates.map((item) => toDocumentText(item.metadata));
  const docEmbeddings8B = await embedWithDeepInfra(docs, rerankEmbeddingModel);

  return candidates
    .map(
      (candidate, idx): RankedResult => ({
        ...candidate,
        rerankScore: cosineSimilarity(queryEmbedding8B, docEmbeddings8B[idx]),
      })
    )
    .sort((a, b) => {
      if (b.rerankScore !== a.rerankScore) {
        return b.rerankScore - a.rerankScore;
      }

      return b.vectorScore - a.vectorScore;
    })
    .slice(0, 8);
}
