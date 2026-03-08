"use client";

import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ChatMenuItems } from "@/components/chat-menu-items";
import { ChatRenameDialog } from "@/components/chat-rename-dialog";
import { DeleteChatDialog } from "@/components/delete-chat-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useGetChatById,
  usePinChat,
  useRenameChat,
} from "@/hooks/chat-sync-hooks";
import { useChatId } from "@/providers/chat-id-provider";
import { ShareDialog } from "./share-button";

export function HeaderChatMenu({
  hasMessages,
  isReadonly,
}: {
  hasMessages?: boolean;
  isReadonly: boolean;
}) {
  const { id: chatId, isPersisted, source } = useChatId();
  const isShared = source === "share";
  const { data: chat } = useGetChatById(chatId, {
    enabled: !isShared && isPersisted,
  });
  const { mutate: pinChatMutation } = usePinChat();
  const renameChatMutation = useRenameChat();

  const [renameOpen, setRenameOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [chatDeleteId, setChatDeleteId] = useState<string | null>(null);
  const [showChatDeleteDialog, setShowChatDeleteDialog] = useState(false);

  if (isReadonly || !chat) {
    return null;
  }

  const handleRenameSubmit = async (title: string) => {
    await renameChatMutation.mutateAsync({ chatId, title });
    toast.success("Chat renamed successfully");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Open chat actions"
            className="size-8 rounded-md"
            size="icon-sm"
            variant="ghost"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <ChatMenuItems
            isPinned={!!chat.isPinned}
            onDelete={() => {
              setChatDeleteId(chatId);
              setShowChatDeleteDialog(true);
            }}
            onRename={() => setRenameOpen(true)}
            onShare={() => setShareOpen(true)}
            onTogglePin={() =>
              pinChatMutation({ chatId, isPinned: !chat.isPinned })
            }
            showShare={!!hasMessages}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      <ChatRenameDialog
        currentTitle={chat.title ?? ""}
        isLoading={renameChatMutation.isPending}
        onOpenChange={setRenameOpen}
        onSubmit={handleRenameSubmit}
        open={renameOpen}
      />

      <DeleteChatDialog
        deleteId={chatDeleteId}
        setShowDeleteDialog={setShowChatDeleteDialog}
        showDeleteDialog={showChatDeleteDialog}
      />

      <ShareDialog
        chatId={chatId}
        onOpenChange={setShareOpen}
        open={shareOpen}
      />
    </>
  );
}
