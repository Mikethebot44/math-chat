"use client";

import type { ChatEnqueueResponse, RunStreamEvent } from "@/lib/agent-runs/types";
import type { ChatMessage } from "@/lib/ai/types";
import { fetchWithErrorHandlers } from "@/lib/utils";

export async function enqueueAuthenticatedChatMessage({
  chatId,
  message,
  projectId,
}: {
  chatId: string;
  message: ChatMessage;
  projectId?: string;
}): Promise<ChatEnqueueResponse> {
  const response = await fetchWithErrorHandlers("/api/chat", {
    body: JSON.stringify({
      id: chatId,
      message,
      prevMessages: [],
      projectId,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const body = await response.text();
    throw new Error(
      `Expected JSON enqueue response from /api/chat, received ${contentType || "unknown content type"}: ${body.slice(0, 200)}`
    );
  }

  return response.json();
}

export async function cancelAgentRun(runId: string) {
  await fetchWithErrorHandlers(`/api/chat/runs/${runId}/cancel`, {
    method: "POST",
  });
}

export function parseRunStreamEvent(raw: MessageEvent<string>): RunStreamEvent {
  return JSON.parse(raw.data) as RunStreamEvent;
}
