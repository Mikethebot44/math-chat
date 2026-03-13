"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AssistantLoader } from "@/components/assistant-loader";
import {
  ARISTOTLE_LOADING_LINE_ROTATION_MS,
  buildFallbackAristotleLoadingLines,
  getAristotlePromptForStatus,
  shuffleAristotleLoadingLines,
} from "@/lib/ai/tools/lean-proof/aristotle-loading-lines";
import type { ChatMessage } from "@/lib/ai/types";
import {
  useLatestAssistantChildCreatedAtByParentId,
  useMessages,
} from "@/lib/stores/hooks-base";
import { useChatId } from "@/providers/chat-id-provider";

type AristotleToolPart = Extract<
  ChatMessage["parts"][number],
  { type: "tool-leanProof" | "tool-aristotleCheckJob" }
>;

export function AristotleLoader({
  messageId,
  tool,
}: {
  messageId: string;
  tool: AristotleToolPart;
}) {
  const { id: chatId } = useChatId();
  const messages = useMessages() as ChatMessage[];
  const continuationCreatedAt =
    useLatestAssistantChildCreatedAtByParentId(messageId);
  const isHardError = tool.state === "output-error";
  const isCompleted = continuationCreatedAt !== null;
  const [lineIndex, setLineIndex] = useState(0);
  const prompt = useMemo(
    () =>
      getAristotlePromptForStatus({
        messageId,
        messages,
        tool,
      }),
    [messageId, messages, tool]
  );
  const shouldGenerateLines =
    Boolean(prompt) && !isHardError && !isCompleted;

  const { data: generatedLines, isFetching: isGeneratingLines } = useQuery({
    queryKey: ["aristotle-loading-lines", chatId, messageId, prompt],
    enabled: shouldGenerateLines,
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async () => {
      const response = await fetch(
        `/api/chat/${chatId}/aristotle-loading-lines`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messageId,
            prompt: prompt ?? "",
          }),
        }
      );

      const payload = (await response.json()) as {
        lines?: unknown;
        source?: unknown;
      };

      if (
        !(
          response.ok &&
          Array.isArray(payload.lines) &&
          payload.lines.every((line) => typeof line === "string")
        )
      ) {
        throw new Error("Failed to load Aristotle status lines");
      }

      if (
        process.env.NODE_ENV === "development" &&
        payload.source === "fallback"
      ) {
        console.warn("Using fallback Aristotle loading lines", {
          chatId,
          messageId,
        });
      }

      return payload.lines;
    },
    retry: 1,
  });

  const rotatingLines = useMemo(() => {
    if (generatedLines?.length) {
      return shuffleAristotleLoadingLines(generatedLines);
    }

    if (prompt && !isGeneratingLines) {
      return shuffleAristotleLoadingLines(
        buildFallbackAristotleLoadingLines(prompt)
      );
    }

    return [];
  }, [generatedLines, isGeneratingLines, prompt]);

  useEffect(() => {
    if (rotatingLines.length <= 1 || isHardError || isCompleted) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setLineIndex((current) => (current + 1) % rotatingLines.length);
    }, ARISTOTLE_LOADING_LINE_ROTATION_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isCompleted, isHardError, rotatingLines]);

  if (isCompleted) {
    return null;
  }

  const activeLine =
    rotatingLines[
      rotatingLines.length > 0 ? lineIndex % rotatingLines.length : 0
    ] ?? null;

  return (
    <AssistantLoader
      label={activeLine ?? "Checking proof..."}
      subtitle={null}
    />
  );
}
