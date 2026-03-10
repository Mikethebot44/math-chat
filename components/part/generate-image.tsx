"use client";

import { useState } from "react";
import { ImageActions, ImageModal } from "@/components/image-modal";
import type { ChatMessage } from "@/lib/ai/types";

export type GenerateImageTool = Extract<
  ChatMessage["parts"][number],
  { type: "tool-generateImage" }
>;

export function GenerateImage({ tool }: { tool: GenerateImageTool }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const input = tool.input as { prompt?: string } | undefined;
  const output = tool.output as
    | {
        imageUrl?: string;
        prompt?: string;
      }
    | undefined;
  const prompt = typeof input?.prompt === "string" ? input.prompt : "";
  const imageUrl =
    typeof output?.imageUrl === "string" ? output.imageUrl : null;
  const outputPrompt =
    typeof output?.prompt === "string" ? output.prompt : prompt;

  if (tool.state === "input-available") {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-4 rounded-lg border p-8">
        <div className="h-64 w-full animate-pulse rounded-lg bg-muted-foreground/20" />
        <div className="text-muted-foreground">
          Generating image: &quot;{prompt}&quot;
        </div>
      </div>
    );
  }

  if (!(imageUrl && outputPrompt)) {
    return null;
  }

  return (
    <>
      <div className="flex w-full flex-col gap-4 overflow-hidden rounded-lg border">
        <div className="group relative">
          <button
            className="w-full cursor-pointer text-left"
            onClick={() => setDialogOpen(true)}
            type="button"
          >
            {/* biome-ignore lint/performance/noImgElement: Next/Image isn't desired for dynamic external URLs here */}
            <img
              alt={outputPrompt}
              className="h-auto w-full max-w-full"
              height={512}
              src={imageUrl}
              width={512}
            />
          </button>
          <ImageActions
            className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100"
            imageUrl={imageUrl}
          />
        </div>
        <div className="p-4 pt-0">
          <p className="text-muted-foreground text-sm">
            Generated from: &quot;{outputPrompt}&quot;
          </p>
        </div>
      </div>

      <ImageModal
        imageName={outputPrompt}
        imageUrl={imageUrl}
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
}
