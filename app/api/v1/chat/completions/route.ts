import { NextResponse, type NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/api/auth";
import {
  createApiCompletionRequestSchema,
  createProgrammaticCompletion,
} from "@/lib/api/chat-completions";

const API_MODEL_NAME = "Scout";

export async function POST(request: NextRequest) {
  const auth = await authenticateApiKey({
    authorizationHeader: request.headers.get("authorization"),
  });

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestBody = await request.json().catch(() => null);
  const parsedRequest = createApiCompletionRequestSchema.safeParse(requestBody);
  if (!parsedRequest.success) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  if (parsedRequest.data.stream === true) {
    return NextResponse.json(
      { error: "Streaming is not supported for this API" },
      { status: 400 }
    );
  }

  if (
    parsedRequest.data.model &&
    parsedRequest.data.model.trim() !== API_MODEL_NAME
  ) {
    return NextResponse.json(
      { error: `Unsupported model '${parsedRequest.data.model}'` },
      { status: 400 }
    );
  }

  const result = await createProgrammaticCompletion({
    messages: parsedRequest.data.messages,
    userId: auth.userId,
  });

  if (result.type === "insufficient_credits") {
    return NextResponse.json(
      { error: "Insufficient credits" },
      { status: 402 }
    );
  }

  return NextResponse.json(result.completion);
}
