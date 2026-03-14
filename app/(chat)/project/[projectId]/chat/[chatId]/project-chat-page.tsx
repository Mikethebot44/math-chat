"use client";
import { useSuspenseQueries } from "@tanstack/react-query";
import { notFound, useParams } from "next/navigation";
import { ChatSystem } from "@/components/chat-system";
import { useChatSystemInitialState } from "@/hooks/use-chat-system-initial-state";
import { useTRPC } from "@/trpc/react";

export function ProjectChatPage() {
  const params = useParams<{ projectId: string; chatId: string }>();
  const trpc = useTRPC();

  const projectId = params.projectId;
  const chatId = params.chatId;
  const [{ data: chat }, { data: messages }] = useSuspenseQueries({
    queries: [
      trpc.chat.getChatById.queryOptions({ chatId }),
      trpc.chat.getChatMessages.queryOptions({ chatId }),
    ],
  });
  const { initialMessages, initialTool } = useChatSystemInitialState(messages);

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
