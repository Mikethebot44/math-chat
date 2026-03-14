"use client";
import { useSuspenseQueries } from "@tanstack/react-query";
import { notFound, redirect } from "next/navigation";
import { ChatSystem } from "@/components/chat-system";
import { Loader } from "@/components/loader";
import { useChatSystemInitialState } from "@/hooks/use-chat-system-initial-state";
import { useChatId } from "@/providers/chat-id-provider";
import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";

function ChatPageContent({ chatId }: { chatId: string }) {
  const trpc = useTRPC();
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
    />
  );
}

export function ChatPage() {
  const { id, isPersisted } = useChatId();
  const { data: session, isPending } = useSession();

  if (!isPersisted) {
    return notFound();
  }

  if (!session?.user) {
    if (isPending) {
      return <Loader label="Loading chat..." subtitle={null} />;
    }

    redirect("/");
  }

  return <ChatPageContent chatId={id} />;
}
