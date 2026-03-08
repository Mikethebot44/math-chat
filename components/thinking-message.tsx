"use client";

import { LoadingStatus } from "@/components/loading-status";

export function ThinkingMessage({
  startedAt,
}: {
  startedAt: Date | string;
}) {
  return (
    <div
      className="group/message mx-auto w-full max-w-3xl px-4"
      data-role="assistant"
      data-testid="message-assistant-loading"
    >
      <LoadingStatus label="Thinking..." startedAt={startedAt} />
    </div>
  );
}
