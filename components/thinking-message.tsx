"use client";

import { Loader } from "@/components/loader";

export function ThinkingMessage({
  startedAt: _startedAt,
}: {
  startedAt: Date | string;
}) {
  return (
    <div
      className="group/message mx-auto w-full max-w-3xl px-4"
      data-role="assistant"
      data-testid="message-assistant-loading"
    >
      <Loader
        className="min-h-[240px]"
        label="Thinking"
        labelShimmer
        subtitle={null}
      />
    </div>
  );
}
