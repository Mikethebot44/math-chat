"use client";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { notFound, useParams } from "next/navigation";
import { ChatSystem } from "@/components/chat-system";
import {
  useGetChatByIdQueryOptions,
  useGetChatMessagesQueryOptions,
} from "@/hooks/chat-sync-hooks";
import { useChatSystemInitialState } from "@/hooks/use-chat-system-initial-state";
import { useChatId } from "@/providers/chat-id-provider";

export function ProjectChatPage() {
  const { id } = useChatId();
  const params = useParams<{ projectId: string; chatId: string }>();

  const projectId = params.projectId;
  const getChatByIdQueryOptions = useGetChatByIdQueryOptions(id);
  const { data: chat } = useSuspenseQuery(getChatByIdQueryOptions);
  const getMessagesByChatIdQueryOptions = useGetChatMessagesQueryOptions();
  const { data: messages } = useQuery(getMessagesByChatIdQueryOptions);
  const { initialMessages, initialTool } = useChatSystemInitialState(messages);

  if (!id) {
    return notFound();
  }

  if (!chat) {
    return notFound();
  }

  return (
    <ChatSystem
      id={chat.id}
      initialMessages={initialMessages}
      initialTool={initialTool}
      isReadonly={false}
      projectId={projectId}
    />
  );
}
