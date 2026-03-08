import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getAgentRunById, getAgentRunForViewer, listAgentRunEvents } from "@/lib/db/agent-runs";

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function encodeSseChunk(data: unknown, event = "message") {
  const payload = JSON.stringify(data);
  return `event: ${event}\ndata: ${payload}\n\n`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id ?? null;

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const run = await getAgentRunForViewer({ runId, userId });
  if (!run) {
    return new Response("Not found", { status: 404 });
  }

  const since = Number(request.nextUrl.searchParams.get("since") ?? "0");
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let cursor = Number.isFinite(since) ? since : 0;
      let heartbeatCounter = 0;

      while (!request.signal.aborted) {
        const events = await listAgentRunEvents({
          runId,
          sinceSequence: cursor,
        });

        for (const event of events) {
          cursor = event.sequence;
          controller.enqueue(
            encoder.encode(
              encodeSseChunk(
                {
                  createdAt: event.createdAt.toISOString(),
                  kind: event.kind,
                  payload: event.payload,
                  runId,
                  sequence: event.sequence,
                },
                "run-event"
              )
            )
          );
        }

        const latestRun = await getAgentRunById({ id: runId });
        if (!latestRun || TERMINAL_STATUSES.has(latestRun.status)) {
          controller.close();
          return;
        }

        heartbeatCounter += 1;
        if (heartbeatCounter % 15 === 0) {
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        }

        await sleep(1000);
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    },
  });
}
