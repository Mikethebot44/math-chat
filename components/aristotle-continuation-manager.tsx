"use client";

import { useChatActions, useChatStatus } from "@ai-sdk-tools/store";
import type { MutableRefObject } from "react";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import type { ChatMessage } from "@/lib/ai/types";
import { useMessages } from "@/lib/stores/hooks-base";
import { useAddMessageToTree } from "@/lib/stores/hooks-threads";

const POLL_INTERVAL_MS = 5000;

interface AristotleContinuationResponse {
  continuationMessage?: ChatMessage;
  sourceMessage?: ChatMessage;
  status: "continued" | "pending";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getPendingAristotleSourceMessage(
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

function upsertMessages(
  currentMessages: ChatMessage[],
  nextMessages: ChatMessage[]
): ChatMessage[] {
  const updated = [...currentMessages];

  for (const nextMessage of nextMessages) {
    const existingIndex = updated.findIndex(
      (message) => message.id === nextMessage.id
    );

    if (existingIndex === -1) {
      updated.push(nextMessage);
      continue;
    }

    updated[existingIndex] = nextMessage;
  }

  return updated;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getContinuationMessages(
  payload: AristotleContinuationResponse
): ChatMessage[] {
  return [payload.sourceMessage, payload.continuationMessage].filter(
    (message): message is ChatMessage => Boolean(message)
  );
}

async function requestAristotleContinuation({
  chatId,
  messageId,
}: {
  chatId: string;
  messageId: string;
}): Promise<AristotleContinuationResponse> {
  const response = await fetch(`/api/chat/${chatId}/aristotle`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messageId }),
  });

  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    throw new Error(
      isRecord(payload) && typeof payload.error === "string"
        ? payload.error
        : "Aristotle continuation failed"
    );
  }

  return payload as AristotleContinuationResponse;
}

function applyContinuationPayload({
  addMessageToTree,
  payload,
  setMessages,
  messagesRef,
}: {
  addMessageToTree: (message: ChatMessage) => void;
  payload: AristotleContinuationResponse;
  setMessages: (messages: ChatMessage[]) => void;
  messagesRef: MutableRefObject<ChatMessage[]>;
}) {
  const nextMessages = getContinuationMessages(payload);

  if (nextMessages.length === 0) {
    return;
  }

  setMessages(upsertMessages(messagesRef.current, nextMessages));
  for (const message of nextMessages) {
    addMessageToTree(message);
  }
}

async function pollAristotleContinuation({
  addMessageToTree,
  chatId,
  isCancelled,
  messageId,
  messagesRef,
  setMessages,
}: {
  addMessageToTree: (message: ChatMessage) => void;
  chatId: string;
  isCancelled: () => boolean;
  messageId: string;
  messagesRef: MutableRefObject<ChatMessage[]>;
  setMessages: (messages: ChatMessage[]) => void;
}) {
  while (!isCancelled()) {
    const payload = await requestAristotleContinuation({
      chatId,
      messageId,
    });

    if (isCancelled()) {
      return;
    }

    applyContinuationPayload({
      addMessageToTree,
      payload,
      setMessages,
      messagesRef,
    });

    if (payload.status === "continued") {
      return;
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

export function AristotleContinuationManager({ chatId }: { chatId: string }) {
  const status = useChatStatus();
  const messages = useMessages() as ChatMessage[];
  const { setMessages } = useChatActions<ChatMessage>();
  const addMessageToTree = useAddMessageToTree();
  const activeMessageIdRef = useRef<string | null>(null);
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const pendingMessage = useMemo(
    () => getPendingAristotleSourceMessage(messages),
    [messages]
  );

  useEffect(() => {
    if (!pendingMessage || status !== "ready") {
      return;
    }

    if (activeMessageIdRef.current === pendingMessage.id) {
      return;
    }

    let cancelled = false;
    activeMessageIdRef.current = pendingMessage.id;

    pollAristotleContinuation({
      addMessageToTree,
      chatId,
      isCancelled: () => cancelled,
      messageId: pendingMessage.id,
      messagesRef,
      setMessages,
    })
      .catch((error) => {
        if (!cancelled) {
          toast.error("Failed to continue Aristotle job", {
            description:
              error instanceof Error ? error.message : "Unknown error",
          });
        }
      })
      .finally(() => {
        if (activeMessageIdRef.current === pendingMessage.id) {
          activeMessageIdRef.current = null;
        }
      });

    return () => {
      cancelled = true;
    };
  }, [addMessageToTree, chatId, pendingMessage, setMessages, status]);

  return null;
}
