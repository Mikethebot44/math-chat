import { Sandbox } from "e2b";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getAgentRunForOwner, requestAgentRunCancellation } from "@/lib/db/agent-runs";
import { env } from "@/lib/env";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id ?? null;

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const run = await getAgentRunForOwner({ runId, userId });
  if (!run) {
    return new Response("Not found", { status: 404 });
  }

  await requestAgentRunCancellation({ runId });

  if (env.E2B_API_KEY && run.sandboxId) {
    try {
      await Sandbox.kill(run.sandboxId);
    } catch {
      // Best-effort cancel. The worker/sandbox runner will observe the cancellation flag.
    }
  }

  return Response.json({ success: true });
}
