import type { ChatMessage, RunStatusData } from "@/lib/ai/types";

export const RUN_STATUS_PART_ID = "run-status";

export type RunStatusPhase =
  | "queued"
  | "starting"
  | "thinking"
  | "tool"
  | "waiting-aristotle"
  | "finalizing";

export function buildRunStatusPart({
  detail,
  label,
  phase,
  startedAt,
}: {
  detail?: string;
  label: string;
  phase: RunStatusPhase;
  startedAt: string;
}): Extract<ChatMessage["parts"][number], { type: "data-runStatus" }> {
  const data: RunStatusData = {
    detail,
    label,
    phase,
    startedAt,
    updatedAt: new Date().toISOString(),
  };

  return {
    data,
    id: RUN_STATUS_PART_ID,
    type: "data-runStatus",
  };
}
