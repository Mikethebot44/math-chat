import { NextResponse, type NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/api/auth";
import { pollProgrammaticCompletion } from "@/lib/api/chat-completions";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ completionId: string }> }
) {
  const auth = await authenticateApiKey({
    authorizationHeader: request.headers.get("authorization"),
  });

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { completionId } = await params;
  const completion = await pollProgrammaticCompletion({
    completionId,
    userId: auth.userId,
  });

  if (!completion) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(completion);
}
