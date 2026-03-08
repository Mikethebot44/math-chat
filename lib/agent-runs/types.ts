import type { ChatMessage, ToolName } from "@/lib/ai/types";

export const AGENT_RUN_STATUSES = [
  "queued",
  "starting",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

export type AgentRunStatus = (typeof AGENT_RUN_STATUSES)[number];

export const AGENT_RUN_EVENT_KINDS = [
  "run-queued",
  "run-started",
  "text-start",
  "text-delta",
  "text-finish",
  "reasoning-part",
  "tool-call",
  "tool-update",
  "tool-result",
  "status-update",
  "usage",
  "run-completed",
  "run-failed",
  "run-cancelled",
] as const;

export type AgentRunEventKind = (typeof AGENT_RUN_EVENT_KINDS)[number];

export interface AgentRunErrorPayload {
  message: string;
  retryable?: boolean;
  details?: unknown;
}

export interface AgentRunQueuedPayload {
  assistantMessageId: string;
  chatId: string;
  userMessageId: string;
}

export interface AgentRunStartedPayload {
  sandboxId?: string | null;
  startedAt: string;
}

export interface AgentRunTextStartPayload {
  index: number;
}

export interface AgentRunTextDeltaPayload {
  delta: string;
  index: number;
}

export interface AgentRunTextFinishPayload {
  index: number;
}

export interface AgentRunReasoningPayload {
  index: number;
  text: string;
}

export interface AgentRunToolCallPayload {
  index: number;
  part: Extract<ChatMessage["parts"][number], { type: `tool-${string}` }>;
}

export interface AgentRunToolUpdatePayload {
  index: number;
  part: Extract<ChatMessage["parts"][number], { type: `tool-${string}` }>;
}

export interface AgentRunToolResultPayload {
  index: number;
  part: Extract<ChatMessage["parts"][number], { type: `tool-${string}` }>;
}

export interface AgentRunStatusUpdatePayload {
  part: Extract<ChatMessage["parts"][number], { type: `data-${string}` }>;
}

export interface AgentRunUsagePayload {
  usage: ChatMessage["metadata"]["usage"];
}

export interface AgentRunCompletedPayload {
  completedAt: string;
}

export interface AgentRunCancelledPayload {
  cancelledAt: string;
}

export interface CreateAgentRunInput {
  assistantMessageId: string;
  chatId: string;
  requestedTools: ToolName[] | null;
  selectedModel: string;
  userId: string;
  userMessageId: string;
}

export interface ChatEnqueueResponse {
  assistantMessage: ChatMessage;
  assistantMessageId: string;
  chatId: string;
  runId: string;
}

export interface RunStreamEvent {
  kind: AgentRunEventKind;
  payload: unknown;
  runId: string;
  sequence: number;
  createdAt: string;
}
