import equal from "fast-deep-equal";
import type {
  AgentRunEventKind,
  AgentRunStatusUpdatePayload,
  AgentRunTextDeltaPayload,
  AgentRunTextFinishPayload,
  AgentRunTextStartPayload,
  AgentRunToolCallPayload,
  AgentRunToolResultPayload,
  AgentRunToolUpdatePayload,
  AgentRunUsagePayload,
  RunStreamEvent,
} from "@/lib/agent-runs/types";
import type { ChatMessage } from "@/lib/ai/types";

type MessageEvent = Pick<RunStreamEvent, "kind" | "payload">;

function isToolPart(
  part: ChatMessage["parts"][number] | undefined
): part is Extract<ChatMessage["parts"][number], { type: `tool-${string}` }> {
  return Boolean(part && part.type.startsWith("tool-"));
}

function isDataPart(
  part: ChatMessage["parts"][number] | undefined
): part is Extract<ChatMessage["parts"][number], { type: `data-${string}` }> {
  return Boolean(part && part.type.startsWith("data-"));
}

function ensurePartAtIndex(
  parts: ChatMessage["parts"],
  index: number,
  fallback: ChatMessage["parts"][number]
) {
  while (parts.length <= index) {
    parts.push(fallback);
  }
}

export function diffMessageToRunEvents({
  next,
  previous,
}: {
  next: ChatMessage;
  previous: ChatMessage | null;
}): MessageEvent[] {
  const events: MessageEvent[] = [];
  const previousParts = previous?.parts ?? [];

  for (const [index, nextPart] of next.parts.entries()) {
    const previousPart = previousParts[index];

    if (nextPart.type === "text") {
      const previousText =
        previousPart?.type === "text" ? previousPart.text : "";

      if (previousPart?.type !== "text") {
        events.push({
          kind: "text-start",
          payload: { index } satisfies AgentRunTextStartPayload,
        });
      }

      if (nextPart.text !== previousText) {
        const delta = nextPart.text.startsWith(previousText)
          ? nextPart.text.slice(previousText.length)
          : nextPart.text;

        if (delta.length > 0) {
          events.push({
            kind: "text-delta",
            payload: { delta, index } satisfies AgentRunTextDeltaPayload,
          });
        }
      }

      if (
        nextPart.state === "done" &&
        !(previousPart?.type === "text" && previousPart.state === "done")
      ) {
        events.push({
          kind: "text-finish",
          payload: { index } satisfies AgentRunTextFinishPayload,
        });
      }

      continue;
    }

    if (nextPart.type === "reasoning") {
      const previousText =
        previousPart?.type === "reasoning" ? previousPart.text : null;

      if (previousText !== nextPart.text) {
        events.push({
          kind: "reasoning-part",
          payload: { index, text: nextPart.text },
        });
      }

      continue;
    }

    if (isToolPart(nextPart)) {
      if (!isToolPart(previousPart)) {
        events.push({
          kind: "tool-call",
          payload: { index, part: nextPart } satisfies AgentRunToolCallPayload,
        });
        continue;
      }

      if (!equal(previousPart, nextPart)) {
        const kind: AgentRunEventKind =
          nextPart.state === "output-available" ||
          nextPart.state === "output-error" ||
          nextPart.state === "output-denied"
            ? "tool-result"
            : "tool-update";

        events.push({
          kind,
          payload:
            kind === "tool-result"
              ? ({ index, part: nextPart } satisfies AgentRunToolResultPayload)
              : ({ index, part: nextPart } satisfies AgentRunToolUpdatePayload),
        });
      }

      continue;
    }

    if (isDataPart(nextPart)) {
      if (!isDataPart(previousPart) || !equal(previousPart, nextPart)) {
        events.push({
          kind: "status-update",
          payload: {
            part: nextPart,
          } satisfies AgentRunStatusUpdatePayload,
        });
      }
    }
  }

  if (!equal(previous?.metadata?.usage, next.metadata.usage)) {
    events.push({
      kind: "usage",
      payload: { usage: next.metadata.usage } satisfies AgentRunUsagePayload,
    });
  }

  return events;
}

export function applyRunEventToMessage({
  event,
  message,
}: {
  event: MessageEvent;
  message: ChatMessage;
}): ChatMessage {
  const nextMessage: ChatMessage = {
    ...message,
    metadata: { ...message.metadata },
    parts: [...message.parts],
  };

  switch (event.kind) {
    case "text-start": {
      const { index } = event.payload as AgentRunTextStartPayload;
      ensurePartAtIndex(nextMessage.parts, index, {
        type: "text",
        text: "",
      });
      nextMessage.parts[index] = {
        type: "text",
        text: "",
        state: "streaming",
      };
      return nextMessage;
    }

    case "text-delta": {
      const { delta, index } = event.payload as AgentRunTextDeltaPayload;
      const current = nextMessage.parts[index];
      const text = current?.type === "text" ? current.text : "";
      nextMessage.parts[index] = {
        type: "text",
        text: `${text}${delta}`,
        state: "streaming",
      };
      return nextMessage;
    }

    case "text-finish": {
      const { index } = event.payload as AgentRunTextFinishPayload;
      const current = nextMessage.parts[index];
      if (current?.type === "text") {
        nextMessage.parts[index] = {
          ...current,
          state: "done",
        };
      }
      return nextMessage;
    }

    case "reasoning-part": {
      const { index, text } = event.payload as { index: number; text: string };
      nextMessage.parts[index] = {
        type: "reasoning",
        text,
        state: "done",
      };
      return nextMessage;
    }

    case "tool-call":
    case "tool-update":
    case "tool-result": {
      const { index, part } = event.payload as
        | AgentRunToolCallPayload
        | AgentRunToolUpdatePayload
        | AgentRunToolResultPayload;
      nextMessage.parts[index] = part;
      return nextMessage;
    }

    case "status-update": {
      const { part } = event.payload as AgentRunStatusUpdatePayload;
      const matchIndex = nextMessage.parts.findIndex((candidate) => {
        if (!isDataPart(candidate)) {
          return false;
        }

        return part.id
          ? candidate.id === part.id
          : candidate.type === part.type &&
              candidate.id === undefined &&
              part.id === undefined;
      });

      if (matchIndex === -1) {
        nextMessage.parts.push(part);
      } else {
        nextMessage.parts[matchIndex] = part;
      }
      return nextMessage;
    }

    case "usage": {
      const { usage } = event.payload as AgentRunUsagePayload;
      nextMessage.metadata.usage = usage;
      return nextMessage;
    }

    case "run-completed":
    case "run-failed":
    case "run-cancelled": {
      nextMessage.metadata.activeRunId = null;
      return nextMessage;
    }

    default:
      return nextMessage;
  }
}
