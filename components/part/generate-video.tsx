"use client";

import type { ChatMessage } from "@/lib/ai/types";

export type GenerateVideoTool = Extract<
  ChatMessage["parts"][number],
  { type: "tool-generateVideo" }
>;

export function GenerateVideo({ tool }: { tool: GenerateVideoTool }) {
  const input = tool.input as { prompt?: string } | undefined;
  const output = tool.output as
    | {
        prompt?: string;
        videoUrl?: string;
      }
    | undefined;
  const prompt = typeof input?.prompt === "string" ? input.prompt : "";
  const outputPrompt =
    typeof output?.prompt === "string" ? output.prompt : prompt;
  const videoUrl =
    typeof output?.videoUrl === "string" ? output.videoUrl : null;

  if (tool.state === "input-available") {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-4 rounded-lg border p-8">
        <div className="h-64 w-full animate-pulse rounded-lg bg-muted-foreground/20" />
        <div className="text-muted-foreground">
          Generating video: &quot;{prompt}&quot;
        </div>
      </div>
    );
  }

  if (!(videoUrl && outputPrompt)) {
    const fallbackPrompt = prompt || "the same idea";

    return (
      <div className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border p-4 text-muted-foreground text-sm">
        <div>Couldn&apos;t generate video.</div>
        <div className="text-xs">
          Try again with a different prompt: &quot;{fallbackPrompt}&quot;
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4 overflow-hidden rounded-lg border">
      <video
        autoPlay
        className="h-auto w-full max-w-full"
        controls
        loop
        muted
        playsInline
        src={videoUrl}
      />
      <div className="p-4 pt-0">
        <p className="text-muted-foreground text-sm">
          Generated from: &quot;{outputPrompt}&quot;
        </p>
      </div>
    </div>
  );
}
