"use client";
import { ChatSystem } from "@/components/chat-system";
import { useChatId } from "@/providers/chat-id-provider";

export function ChatHome() {
  const { id } = useChatId();
  return <ChatSystem id={id} initialMessages={[]} isReadonly={false} />;
}
