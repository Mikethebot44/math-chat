"use client";

import { useEffect, useMemo, useState } from "react";
import { ShimmerText } from "@/components/shimmer-text";
import type { ChatMessage } from "@/lib/ai/types";
import {
  useLatestAssistantChildCreatedAtByParentId,
  useMessageMetadataById,
} from "@/lib/stores/hooks-base";

type AristotleToolPart = Extract<
  ChatMessage["parts"][number],
  { type: "tool-leanProof" | "tool-aristotleCheckJob" }
>;

interface AristotleTimingOutput {
  completed?: boolean;
  completedAt?: string;
  failed?: boolean;
  startedAt?: string;
  thoughtDurationMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getTimingOutput(
  tool: AristotleToolPart
): AristotleTimingOutput | null {
  if (tool.state !== "output-available" || !isRecord(tool.output)) {
    return null;
  }

  return tool.output as AristotleTimingOutput;
}

function toTimestamp(value: Date | string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

export function AristotleThinkingStatus({
  messageId,
  tool,
}: {
  messageId: string;
  tool: AristotleToolPart;
}) {
  const metadata = useMessageMetadataById(messageId);
  const continuationCreatedAt =
    useLatestAssistantChildCreatedAtByParentId(messageId);
  const output = getTimingOutput(tool);
  const startedAtMs =
    toTimestamp(output?.startedAt) ??
    toTimestamp(metadata.createdAt) ??
    Date.now();
  const continuationCreatedAtMs = toTimestamp(continuationCreatedAt);
  const completedAtMs = toTimestamp(output?.completedAt);
  const persistedDurationMs = output?.thoughtDurationMs;
  const hasResolvedTimestamp =
    completedAtMs !== null || continuationCreatedAtMs !== null;
  const isResolved =
    tool.state === "output-error" ||
    Boolean(output?.completed) ||
    Boolean(output?.failed) ||
    hasResolvedTimestamp;
  const resolvedAtMs = useMemo(() => {
    if (typeof persistedDurationMs === "number") {
      return startedAtMs + persistedDurationMs;
    }

    return completedAtMs ?? continuationCreatedAtMs;
  }, [
    completedAtMs,
    continuationCreatedAtMs,
    persistedDurationMs,
    startedAtMs,
  ]);

  const [now, setNow] = useState(() => Date.now());
  const [frozenResolvedAtMs, setFrozenResolvedAtMs] = useState<number | null>(
    () => resolvedAtMs ?? null
  );

  useEffect(() => {
    if (!isResolved) {
      setFrozenResolvedAtMs(null);
      return;
    }

    setFrozenResolvedAtMs((current) => current ?? resolvedAtMs ?? Date.now());
  }, [isResolved, resolvedAtMs]);

  useEffect(() => {
    if (frozenResolvedAtMs !== null) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [frozenResolvedAtMs]);

  const elapsedMs = Math.max(0, (frozenResolvedAtMs ?? now) - startedAtMs);
  const elapsedText = formatElapsed(elapsedMs);

  if (frozenResolvedAtMs !== null) {
    return (
      <div className="py-2 text-muted-foreground text-sm">
        thought for{" "}
        <span className="font-medium text-foreground/90 tabular-nums">
          {elapsedText}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 py-2 text-sm">
      <span className="font-medium text-foreground/90 tabular-nums">
        {elapsedText}
      </span>
      <ShimmerText className="text-muted-foreground" delay={0} duration={1.2}>
        thinking...
      </ShimmerText>
    </div>
  );
}
