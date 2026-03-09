import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";

const requestSchema = z.object({
  query: z.string().min(2).max(500),
});

type SourceType = "paper" | "theorem" | "stack-exchange";

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

const vectorDatabases: Array<{ host: string | undefined; source: SourceType }> =
  [
    { host: process.env.PINECONE_PAPERS_HOST, source: "paper" },
    { host: process.env.PINECONE_THEOREMS_HOST, source: "theorem" },
    {
      host: process.env.PINECONE_STACK_EXCHANGE_HOST,
      source: "stack-exchange",
    },
  ];

const embedWithDeepInfra = async (
  input: string | string[],
  model: string
): Promise<number[][]> => {
  const response = await fetch(
    "https://api.deepinfra.com/v1/openai/embeddings",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DEEPINFRA_API_KEY}`,
      },
      body: JSON.stringify({ model, input }),
    }
  );

  if (!response.ok) {
    throw new Error(`Embedding request failed (${response.status})`);
  }

  const payload = (await response.json()) as {
    data: Array<{ embedding: number[] }>;
  };

  return payload.data.map((item) => item.embedding);
};

const queryPinecone = async (
  host: string,
  vector: number[],
  topK = 12
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

  if (!response.ok) {
    throw new Error(`Pinecone query failed (${response.status})`);
  }

  const payload = (await response.json()) as { matches?: PineconeMatch[] };
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

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    !(process.env.DEEPINFRA_API_KEY && process.env.PINECONE_API_KEY) ||
    vectorDatabases.some((db) => !db.host)
  ) {
    return NextResponse.json(
      { error: "Math search is not configured on the server." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { query } = requestSchema.parse(body);

    const [queryEmbedding4B] = await embedWithDeepInfra(
      query,
      "Qwen/Qwen3-Embedding-4B"
    );

    const searchResponses = await Promise.all(
      vectorDatabases.map(async (db) => {
        const matches = await queryPinecone(
          db.host ?? "",
          queryEmbedding4B,
          12
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
      return NextResponse.json({ results: [] });
    }

    const [queryEmbedding8B] = await embedWithDeepInfra(
      query,
      "Qwen/Qwen3-Embedding-8B"
    );

    const docs = candidates.map((item) => toDocumentText(item.metadata));
    const docEmbeddings8B = await embedWithDeepInfra(
      docs,
      "Qwen/Qwen3-Embedding-8B"
    );

    const ranked = candidates
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

    return NextResponse.json({ results: ranked });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid search query." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Math search failed.",
      },
      { status: 500 }
    );
  }
}
