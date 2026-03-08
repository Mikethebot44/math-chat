"use client";

import { useChat, useChatActions } from "@ai-sdk-tools/store";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useDataStream } from "@/components/data-stream-provider";
import { useSaveMessageMutation } from "@/hooks/chat-sync-hooks";
import { useBackgroundChatConfig } from "@/hooks/use-background-chat-config";
import { useCompleteDataPart } from "@/hooks/use-complete-data-part";
import { applyRunEventToMessage } from "@/lib/agent-runs/message-events";
import { parseRunStreamEvent } from "@/lib/agent-runs/client";
import { ChatSDKError } from "@/lib/ai/errors";
import type { ChatMessage } from "@/lib/ai/types";
import { useMessages } from "@/lib/stores/hooks-base";
import {
  useAddMessageToTree,
  useThreadInitialMessages,
} from "@/lib/stores/hooks-threads";
import { fetchWithErrorHandlers, generateUUID } from "@/lib/utils";
import { useTRPC } from "@/trpc/react";

function AnonymousChatSync({
  id,
  isAuthenticated,
  projectId,
}: {
  id: string;
  isAuthenticated: boolean;
  projectId?: string;
}) {
  const { mutate: saveChatMessage } = useSaveMessageMutation();
  const { setDataStream } = useDataStream();
  const [_, setAutoResume] = useState(true);
  const { stop } = useChatActions<ChatMessage>();
  const threadInitialMessages = useThreadInitialMessages();
  const addMessageToTree = useAddMessageToTree();

  const lastMessage = threadInitialMessages.at(-1);
  const isLastMessagePartial = !!lastMessage?.metadata?.activeStreamId;

  useEffect(
    () => () => {
      stop?.();
      setDataStream([]);
    },
    [setDataStream, stop]
  );

  useChat<ChatMessage>({
    experimental_throttle: 100,
    id,
    messages: threadInitialMessages,
    generateId: generateUUID,
    onFinish: ({ message }) => {
      addMessageToTree(message);
      saveChatMessage({ message, chatId: id });
      setAutoResume(true);
    },
    resume: isLastMessagePartial,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      fetch: fetchWithErrorHandlers as typeof fetch,
      prepareSendMessagesRequest({ messages, id: requestId, body }) {
        setAutoResume(true);

        return {
          body: {
            id: requestId,
            message: messages.at(-1),
            prevMessages: isAuthenticated ? [] : messages.slice(0, -1),
            projectId,
            ...body,
          },
        };
      },
      prepareReconnectToStreamRequest({ id: chatId }) {
        const partialMessageId = lastMessage?.metadata?.activeStreamId
          ? lastMessage.id
          : null;
        return {
          api: `/api/chat/${chatId}/stream${partialMessageId ? `?messageId=${partialMessageId}` : ""}`,
        };
      },
    }),
    onData: (dataPart) => {
      setDataStream((ds) =>
        ds ? [...ds, dataPart as (typeof ds)[number]] : []
      );
    },
    onError: (error) => {
      if (
        error instanceof ChatSDKError &&
        error.type === "not_found" &&
        error.surface === "stream"
      ) {
        setAutoResume(false);
      }

      console.error(error);
      const cause = error.cause;
      if (cause && typeof cause === "string") {
        toast.error(error.message ?? "An error occured, please try again!", {
          description: cause,
        });
      } else {
        toast.error(error.message ?? "An error occured, please try again!");
      }
    },
  });

  useCompleteDataPart();

  return null;
}

function findLatestActiveRun(messages: ChatMessage[]) {
  const assistantMessages = messages.filter(
    (message) => message.role === "assistant" && message.metadata.activeRunId
  );

  return assistantMessages.at(-1) ?? null;
}

function AuthenticatedBackgroundChatSync({ chatId }: { chatId: string }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const { setDataStream } = useDataStream();
  const messages = useMessages() as ChatMessage[];
  const activeRunMessage = useMemo(
    () => findLatestActiveRun(messages),
    [messages]
  );
  const messagesRef = useRef(messages);
  const eventSourceRef = useRef<EventSource | null>(null);
  const activeRunIdRef = useRef<string | null>(null);
  const lastSequenceByRunRef = useRef<Record<string, number>>({});
  const { setError, setMessages, setStatus } = useChatActions<ChatMessage>();

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!activeRunMessage?.metadata.activeRunId) {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      activeRunIdRef.current = null;
      return;
    }

    const runId = activeRunMessage.metadata.activeRunId;
    if (activeRunIdRef.current === runId && eventSourceRef.current) {
      return;
    }

    eventSourceRef.current?.close();
    activeRunIdRef.current = runId;
    setStatus("submitted");

    const since = lastSequenceByRunRef.current[runId] ?? 0;
    const eventSource = new EventSource(
      `/api/chat/runs/${runId}/stream?since=${since}`
    );
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("run-event", (rawEvent) => {
      const event = parseRunStreamEvent(rawEvent as MessageEvent<string>);
      lastSequenceByRunRef.current[runId] = event.sequence;

      if (
        event.kind === "run-started" ||
        event.kind === "text-start" ||
        event.kind === "text-delta" ||
        event.kind === "tool-call" ||
        event.kind === "tool-update" ||
        event.kind === "tool-result" ||
        event.kind === "reasoning-part"
      ) {
        setStatus("streaming");
      }

      if (event.kind === "status-update") {
        const statusPart = (event.payload as { part?: unknown }).part;
        if (statusPart) {
          setDataStream((current) =>
            current
              ? [...current, statusPart as (typeof current)[number]]
              : [statusPart as (typeof current)[number]]
          );
        }
      }

      setMessages(
        messagesRef.current.map((message) =>
          message.metadata.activeRunId === runId || message.id === activeRunMessage.id
            ? applyRunEventToMessage({ event, message })
            : message
        )
      );

      if (
        event.kind === "run-completed" ||
        event.kind === "run-failed" ||
        event.kind === "run-cancelled"
      ) {
        setStatus(event.kind === "run-failed" ? "error" : "ready");
        void Promise.all([
          qc.invalidateQueries({
            queryKey: trpc.chat.getChatMessages.queryKey({ chatId }),
          }),
          qc.invalidateQueries({
            queryKey: trpc.chat.getChatById.queryKey({ chatId }),
          }),
          qc.invalidateQueries({
            queryKey: trpc.credits.getAvailableCredits.queryKey(),
          }),
        ]);
        eventSource.close();
        eventSourceRef.current = null;
      }
    });

    eventSource.onerror = () => {
      setError(new Error("Background run stream disconnected"));
      eventSource.close();
      eventSourceRef.current = null;
    };

    return () => {
      eventSource.close();
      if (eventSourceRef.current === eventSource) {
        eventSourceRef.current = null;
      }
    };
  }, [
    activeRunMessage,
    chatId,
    qc,
    setDataStream,
    setError,
    setMessages,
    setStatus,
    trpc.chat,
    trpc.credits,
  ]);

  return null;
}

export function ChatSync({
  id,
  projectId,
}: {
  id: string;
  projectId?: string;
}) {
  const {
    backgroundChatEnabled,
    isAuthenticated,
    isRuntimeConfigResolved,
  } = useBackgroundChatConfig();

  if (isAuthenticated && !isRuntimeConfigResolved) {
    return null;
  }

  if (isAuthenticated && backgroundChatEnabled) {
    return <AuthenticatedBackgroundChatSync chatId={id} />;
  }

  return (
    <AnonymousChatSync
      id={id}
      isAuthenticated={isAuthenticated}
      projectId={projectId}
    />
  );
}
