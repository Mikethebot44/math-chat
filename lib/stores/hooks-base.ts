// This file has hooks that are enabled by the @ai-sdk-tools/store

import {
  type StoreState,
  useChatStatus,
  useChatStoreApi,
} from "@ai-sdk-tools/store";
import type { ChatStatus } from "ai";
import equal from "fast-deep-equal";
import { shallow } from "zustand/shallow";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { stripProviderLeanHeader } from "../ai/tools/lean-proof/normalize-lean-source";
import type { ChatMessage } from "../ai/types";

function useBaseChatStore<T = StoreState<ChatMessage>>(
  selector?: (store: StoreState<ChatMessage>) => T,
  equalityFn?: (a: T, b: T) => boolean
) {
  const store = useChatStoreApi<ChatMessage>();
  if (!store) {
    throw new Error("useBaseChatStore must be used within ChatStoreProvider");
  }
  const selectorOrIdentity =
    (selector as (s: StoreState<ChatMessage>) => T) ??
    ((s: StoreState<ChatMessage>) => s);
  return useStoreWithEqualityFn(store, selectorOrIdentity, equalityFn);
}

// Base selector hooks using throttled messages where relevant
export const useMessageIds = () =>
  useBaseChatStore((state) => state.getMessageIds(), shallow);

export const useMessages = () =>
  useBaseChatStore((state) => state._throttledMessages || state.messages);

export const useLastUsageUntilMessageId = (messageId: string | null) =>
  useBaseChatStore((state) => {
    if (!messageId) {
      return;
    }
    const messages = state._throttledMessages || state.messages;
    const messageIdx = messages.findIndex((m) => m.id === messageId);
    if (messageIdx === -1) {
      return;
    }

    const sliced = messages.slice(0, messageIdx + 1);
    return sliced.findLast((m) => m.role === "assistant" && m.metadata?.usage)
      ?.metadata?.usage;
  }, shallow);

export const useMessageRoleById = (messageId: string): ChatMessage["role"] =>
  useBaseChatStore((state) => {
    const message = state
      .getThrottledMessages()
      .find((m) => m.id === messageId);
    if (!message) {
      throw new Error(`Message not found for id: ${messageId}`);
    }
    return message.role;
  });
export const useMessageResearchUpdatePartsById = (
  messageId: string
): Extract<ChatMessage["parts"][number], { type: "data-researchUpdate" }>[] =>
  useBaseChatStore((state) => {
    const message = state
      .getThrottledMessages()
      .find((m) => m.id === messageId);
    if (!message) {
      throw new Error(`Message not found for id: ${messageId}`);
    }
    return message.parts.filter(
      (p) => p.type === "data-researchUpdate"
    ) as Extract<
      ChatMessage["parts"][number],
      { type: "data-researchUpdate" }
    >[];
  }, equal);

export const useMessageMetadataById = (
  messageId: string
): ChatMessage["metadata"] =>
  useBaseChatStore((state) => {
    const message = state
      .getThrottledMessages()
      .find((m) => m.id === messageId);
    if (!message) {
      throw new Error(`Message not found for id: ${messageId}`);
    }
    return message.metadata;
  }, shallow);

function getOriginUserMessage(
  messages: ChatMessage[],
  messageId: string
): ChatMessage | null {
  let currentMessage = getMessageById(messages, messageId);

  while (currentMessage) {
    if (currentMessage.role === "user") {
      return currentMessage;
    }

    const parentMessageId = currentMessage.metadata.parentMessageId;
    if (!parentMessageId) {
      return null;
    }

    currentMessage = getMessageById(messages, parentMessageId);
  }

  return null;
}

export const useOriginUserCreatedAtByMessageId = (
  messageId: string
): Date | null =>
  useBaseChatStore((state) => {
    const messages = state.getThrottledMessages();
    return getOriginUserMessage(messages, messageId)?.metadata.createdAt ?? null;
  }, shallow);

function hasAristotleToolPart(message: ChatMessage | undefined): boolean {
  return Boolean(
    message?.parts.some(
      (part) =>
        part.type === "tool-leanProof" || part.type === "tool-aristotleCheckJob"
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getMessageById(messages: ChatMessage[], messageId: string) {
  return messages.find((candidate) => candidate.id === messageId);
}

export function findPendingAristotleSourceMessage(
  messages: ChatMessage[]
): ChatMessage | null {
  const assistantMessages = messages.filter(
    (message) => message.role === "assistant"
  );

  for (let index = assistantMessages.length - 1; index >= 0; index -= 1) {
    const message = assistantMessages[index];

    for (const part of message.parts) {
      if (
        (part.type === "tool-leanProof" ||
          part.type === "tool-aristotleCheckJob") &&
        part.state === "output-available" &&
        isRecord(part.output) &&
        typeof part.output.jobId === "string" &&
        part.output.completed !== true &&
        part.output.failed !== true
      ) {
        return message;
      }
    }
  }

  return null;
}

function getAristotleSourceMessage(
  messages: ChatMessage[],
  messageId: string
): ChatMessage | null {
  const message = getMessageById(messages, messageId);
  if (message && hasAristotleToolPart(message)) {
    return message;
  }

  if (!message?.metadata.parentMessageId) {
    return null;
  }

  const sourceMessage = getMessageById(
    messages,
    message.metadata.parentMessageId
  );
  return sourceMessage && hasAristotleToolPart(sourceMessage)
    ? sourceMessage
    : null;
}

function getAristotleOutputParts(sourceMessage: ChatMessage) {
  return sourceMessage.parts.filter(
    (part) =>
      (part.type === "tool-leanProof" ||
        part.type === "tool-aristotleCheckJob") &&
      part.state === "output-available" &&
      typeof part.output === "object" &&
      part.output !== null
  );
}

function getAristotleStartedAtMs(sourceMessage: ChatMessage): number {
  const sourcePart = getAristotleOutputParts(sourceMessage).find(
    (part) => "startedAt" in part.output
  );
  const startedAt =
    sourcePart &&
    typeof (sourcePart.output as { startedAt?: unknown }).startedAt === "string"
      ? new Date(
          (sourcePart.output as { startedAt: string }).startedAt
        ).getTime()
      : new Date(sourceMessage.metadata.createdAt).getTime();

  return startedAt;
}

function getLeanCodeFromAristotleOutput(output: {
  leanCode?: unknown;
  rawResponse?: { lean_code?: unknown } | unknown;
}): string | null {
  if (typeof output.leanCode === "string" && output.leanCode.trim()) {
    return output.leanCode.trim();
  }

  if (
    !(typeof output.rawResponse === "object" && output.rawResponse !== null)
  ) {
    return null;
  }

  const leanCode = (output.rawResponse as { lean_code?: unknown }).lean_code;
  if (typeof leanCode !== "string" || !leanCode.trim()) {
    return null;
  }

  return stripProviderLeanHeader(leanCode);
}

export const useLatestAssistantChildCreatedAtByParentId = (
  parentMessageId: string
): Date | null =>
  useBaseChatStore((state) => {
    const message = state
      .getThrottledMessages()
      .filter(
        (candidate) =>
          candidate.role === "assistant" &&
          candidate.metadata.parentMessageId === parentMessageId
      )
      .sort(
        (a, b) =>
          new Date(b.metadata.createdAt).getTime() -
          new Date(a.metadata.createdAt).getTime()
      )[0];

    return message?.metadata.createdAt ?? null;
  }, shallow);

export const useMessageHasAristotleContext = (messageId: string): boolean =>
  useBaseChatStore((state) => {
    const messages = state.getThrottledMessages();
    const message = messages.find((candidate) => candidate.id === messageId);
    if (!message) {
      return false;
    }

    if (hasAristotleToolPart(message)) {
      return true;
    }

    if (!message.metadata.parentMessageId) {
      return false;
    }

    const parentMessage = messages.find(
      (candidate) => candidate.id === message.metadata.parentMessageId
    );

    return hasAristotleToolPart(parentMessage);
  });

export const useAristotleThoughtDurationMs = (
  messageId: string
): number | null =>
  useBaseChatStore((state) => {
    const messages = state.getThrottledMessages();
    const message = getMessageById(messages, messageId);
    const sourceMessage = getAristotleSourceMessage(messages, messageId);
    if (!(message && sourceMessage)) {
      return null;
    }

    const startedAt = getAristotleStartedAtMs(sourceMessage);
    const completedAt = new Date(message.metadata.createdAt).getTime();

    if (!(Number.isFinite(startedAt) && Number.isFinite(completedAt))) {
      return null;
    }

    return Math.max(0, completedAt - startedAt);
  });

export const useAristotleLeanDownloadData = (
  messageId: string
): { code: string; jobId: string | null } | null =>
  useBaseChatStore((state) => {
    const messages = state.getThrottledMessages();
    const sourceMessage = getAristotleSourceMessage(messages, messageId);
    if (!sourceMessage) {
      return null;
    }

    for (const part of getAristotleOutputParts(sourceMessage)) {
      const output = part.output as {
        jobId?: unknown;
        leanCode?: unknown;
        rawResponse?: { lean_code?: unknown } | unknown;
      };
      const leanCode = getLeanCodeFromAristotleOutput(output);

      if (!leanCode) {
        continue;
      }

      return {
        code: leanCode,
        jobId: typeof output.jobId === "string" ? output.jobId : null,
      };
    }

    return null;
  }, shallow);

export const useLastMessageId = () =>
  useBaseChatStore((state) => state.getLastMessageId());

export const usePendingAristotleSourceMessageId = (): string | null =>
  useBaseChatStore(
    (state) =>
      findPendingAristotleSourceMessage(state.getThrottledMessages())?.id ??
      null
  );

export function useChatBusyState(): {
  displayStatus: ChatStatus;
  hasPendingAristotle: boolean;
  isBusy: boolean;
} {
  const status = useChatStatus();
  const pendingAristotleSourceMessageId = usePendingAristotleSourceMessageId();
  const hasPendingAristotle = pendingAristotleSourceMessageId !== null;
  const isBusy =
    status === "submitted" || status === "streaming" || hasPendingAristotle;
  const displayStatus =
    hasPendingAristotle && status === "ready" ? "submitted" : status;

  return {
    displayStatus,
    hasPendingAristotle,
    isBusy,
  };
}
