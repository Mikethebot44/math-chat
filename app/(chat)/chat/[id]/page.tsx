import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import { ChatPage } from "./chat-page";

export default async function ChatPageRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: chatId } = await params;

  // Prefetch chat metadata only so the page shell can render immediately.
  prefetch(trpc.chat.getChatById.queryOptions({ chatId }));
  prefetch(trpc.chat.getChatMessages.queryOptions({ chatId }));

  return (
    <HydrateClient>
      <ChatPage />
    </HydrateClient>
  );
}
