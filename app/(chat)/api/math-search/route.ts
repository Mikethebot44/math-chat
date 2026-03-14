import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { isMathSearchConfigured, searchMath } from "@/lib/math-search/search";
import { mathSearchQuerySchema } from "@/lib/math-search/types";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isMathSearchConfigured()) {
    return NextResponse.json(
      { error: "Math paper search is not currently available." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { query } = mathSearchQuerySchema.parse(body);
    return NextResponse.json({ results: await searchMath(query) });
  } catch (error) {
    console.error("[math-search] POST failed", {
      error: error instanceof Error ? error.message : error,
    });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid search query." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Math paper search failed.",
      },
      { status: 500 }
    );
  }
}
