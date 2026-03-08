"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { memo } from "react";
import { ChatWelcomeHeading } from "@/components/chat/chat-welcome-heading";
import { MultimodalInput } from "@/components/multimodal-input";
import type { ChatMessage } from "@/lib/ai/types";
import { useLastMessageId } from "@/lib/stores/hooks-base";
import { cn } from "@/lib/utils";

function PureChatWelcome({
  chatId,
  status,
  className,
}: {
  chatId: string;
  status: UseChatHelpers<ChatMessage>["status"];
  className?: string;
}) {
  const parentMessageId = useLastMessageId();

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col items-center justify-center",
        className
      )}
    >
      <div className="mx-auto w-full p-2 @[500px]:px-4 md:max-w-3xl">
        <div className="mb-6">
          <ChatWelcomeHeading />
        </div>
        <MultimodalInput
          autoFocus
          chatId={chatId}
          parentMessageId={parentMessageId}
          status={status}
        />
      </div>
    </div>
  );
}

export const ChatWelcome = memo(PureChatWelcome);
