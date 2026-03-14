import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getMathSearchExampleCache,
  readMathSearchExampleCache,
} from "@/lib/math-search/example-cache";
import { isMathSearchConfigured } from "@/lib/math-search/search";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cachedExamples = await readMathSearchExampleCache();
    if (cachedExamples && cachedExamples.length > 0) {
      return NextResponse.json({
        examples: cachedExamples,
        source: "file",
      });
    }

    if (!isMathSearchConfigured()) {
      return NextResponse.json({
        examples: [],
        source: "unconfigured",
      });
    }

    return NextResponse.json({
      examples: await getMathSearchExampleCache(),
      source: "generated",
    });
  } catch (error) {
    console.error("[math-search] GET /examples failed", {
      error: error instanceof Error ? error.message : error,
    });

    return NextResponse.json(
      {
        error: "Math search example cache failed.",
      },
      { status: 500 }
    );
  }
}
