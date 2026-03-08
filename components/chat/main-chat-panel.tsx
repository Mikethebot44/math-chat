"use client";

import { ChatHeader } from "@/components/chat-header";
import { useMessageIds } from "@/lib/stores/hooks-base";
import { cn } from "@/lib/utils";
import { useSession } from "@/providers/session-provider";
import { ChatContent } from "./chat-content";
import { EmptyChatBackdrop } from "./empty-chat-backdrop";

export function MainChatPanel({
  chatId,
  projectId,
  isReadonly,
  className,
}: {
  chatId: string;
  projectId?: string;
  isReadonly: boolean;
  className?: string;
}) {
  const { data: session } = useSession();
  const messageIds = useMessageIds() as string[];
  const hasMessages = messageIds.length > 0;
  const showWelcomeBackdrop = !(projectId || hasMessages);

  return (
    <div className={cn("relative isolate overflow-hidden", className)}>
      {showWelcomeBackdrop ? <EmptyChatBackdrop /> : null}

      <ChatHeader
        chatId={chatId}
        className={cn(
          "relative z-20 h-(--header-height)",
          showWelcomeBackdrop && "bg-transparent"
        )}
        hasMessages={hasMessages}
        isReadonly={isReadonly}
        projectId={projectId}
        user={session?.user}
      />

      <ChatContent
        chatId={chatId}
        className={cn(
          "relative z-20 h-[calc(100dvh_-_var(--header-height))]",
          showWelcomeBackdrop && "bg-transparent"
        )}
        isReadonly={isReadonly}
        projectId={projectId}
      />
    </div>
  );
}
