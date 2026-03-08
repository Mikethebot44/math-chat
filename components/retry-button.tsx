import {
  useChatActions,
  useChatStatus,
  useChatStoreApi,
} from "@ai-sdk-tools/store";
import { useQuery } from "@tanstack/react-query";
import { RefreshCcw } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";
import { Action } from "@/components/ai-elements/actions";
import { enqueueAuthenticatedChatMessage } from "@/lib/agent-runs/client";
import type { ChatMessage } from "@/lib/ai/types";
import { useChatBusyState } from "@/lib/stores/hooks-base";
import { useAddMessageToTree } from "@/lib/stores/hooks-threads";
import { useChatId } from "@/providers/chat-id-provider";
import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";

export function RetryButton({
  messageId,
  className,
}: {
  messageId: string;
  className?: string;
}) {
  const { setError, setMessages, setStatus, sendMessage } =
    useChatActions<ChatMessage>();
  const chatStore = useChatStoreApi<ChatMessage>();
  const status = useChatStatus();
  const { isBusy } = useChatBusyState();
  const { id: chatId } = useChatId();
  const { data: session } = useSession();
  const trpc = useTRPC();
  const { data: runtimeConfig } = useQuery({
    ...trpc.chat.getRuntimeConfig.queryOptions(),
    enabled: !!session?.user,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const addMessageToTree = useAddMessageToTree();
  const useBackgroundChat =
    !!session?.user && runtimeConfig?.backgroundChatEnabled === true;

  const handleRetry = useCallback(() => {
    if (!sendMessage) {
      toast.error("Cannot retry this message");
      return;
    }

    // Find the current message (AI response) and its parent (user message)
    const currentMessages = chatStore.getState().messages;
    const currentMessageIdx = currentMessages.findIndex(
      (msg) => msg.id === messageId
    );
    if (currentMessageIdx === -1) {
      toast.error("Cannot find the message to retry");
      return;
    }

    // Find the parent user message (should be the message before the AI response)
    const parentMessageIdx = currentMessageIdx - 1;
    if (parentMessageIdx < 0) {
      toast.error("Cannot find the user message to retry");
      return;
    }

    const parentMessage = currentMessages[parentMessageIdx];
    if (parentMessage.role !== "user") {
      toast.error("Parent message is not from user");
      return;
    }
    setMessages(currentMessages.slice(0, parentMessageIdx));

    const retriedMessage = {
      ...parentMessage,
      metadata: {
        ...parentMessage.metadata,
        createdAt: parentMessage.metadata?.createdAt || new Date(),
        selectedModel: parentMessage.metadata?.selectedModel || "",
        parentMessageId: parentMessage.metadata?.parentMessageId || null,
      },
    };

    if (useBackgroundChat) {
      setMessages([...currentMessages.slice(0, parentMessageIdx), retriedMessage]);
      setError(undefined);
      setStatus("submitted");
      void enqueueAuthenticatedChatMessage({
        chatId,
        message: retriedMessage,
      })
        .then((payload) => {
          addMessageToTree(payload.assistantMessage);
          const nextMessages = chatStore.getState().messages;
          const hasAssistantPlaceholder = nextMessages.some(
            (candidate) => candidate.id === payload.assistantMessage.id
          );
          if (!hasAssistantPlaceholder) {
            setMessages([
              ...nextMessages,
              payload.assistantMessage,
            ] as ChatMessage[]);
          }
        })
        .catch((error) => {
          console.error(error);
          setStatus("error");
          setError(error instanceof Error ? error : new Error("Retry failed"));
          toast.error("Failed to retry message");
        });
    } else {
      sendMessage(retriedMessage, {});
    }

    toast.success("Retrying message...");
  }, [
    addMessageToTree,
    chatId,
    chatStore,
    messageId,
    sendMessage,
    setError,
    setMessages,
    setStatus,
    session?.user,
    trpc.chat,
    useBackgroundChat,
  ]);

  if (isBusy || status === "streaming" || status === "submitted") {
    return null;
  }

  return (
    <Action
      className={`h-7 w-7 text-muted-foreground hover:bg-accent hover:text-accent-foreground p-0${
        className ? ` ${className}` : ""
      }`}
      onClick={handleRetry}
      tooltip="Retry"
    >
      <RefreshCcw className="h-3.5 w-3.5" />
    </Action>
  );
}
