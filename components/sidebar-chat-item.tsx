"use client";
import { MoreHorizontal } from "lucide-react";
import { memo, useState } from "react";
import { toast } from "sonner";
import { ChatMenuItems } from "@/components/chat-menu-items";
import { IntentPrefetchLink } from "@/components/intent-prefetch-link";
import { ShareDialog } from "@/components/share-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { getChatHref } from "@/lib/chat-routes";
import type { UIChat } from "@/lib/types/ui-chat";

const PureSidebarChatItem = ({
  chat,
  isActive,
  onDelete,
  onRename,
  onPin,
  setOpenMobile,
  eagerPrefetch = false,
}: {
  chat: UIChat;
  isActive: boolean;
  onDelete: (chatId: string) => void;
  onRename: (chatId: string, title: string) => void;
  onPin: (chatId: string, isPinned: boolean) => void;
  setOpenMobile: (open: boolean) => void;
  eagerPrefetch?: boolean;
}) => {
  const chatHref = getChatHref({
    chatId: chat.id,
    projectId: chat.projectId,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(chat.title);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const handleRename = async () => {
    if (editTitle.trim() === "" || editTitle === chat.title) {
      setIsEditing(false);
      setEditTitle(chat.title);
      return;
    }

    try {
      await onRename(chat.id, editTitle.trim());
      setIsEditing(false);
      toast.success("Chat renamed successfully");
    } catch (_error) {
      setEditTitle(chat.title);
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRename();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditTitle(chat.title);
    }
  };

  return (
    <SidebarMenuItem>
      {isEditing ? (
        <div className="flex w-full items-center gap-2 overflow-hidden rounded-md bg-background p-2 text-left text-sm">
          <Input
            autoFocus
            className="h-auto border-0 bg-transparent p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
            maxLength={255}
            onBlur={handleRename}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            value={editTitle}
          />
        </div>
      ) : (
        <SidebarMenuButton asChild isActive={isActive}>
          <IntentPrefetchLink
            eagerPrefetch={eagerPrefetch}
            href={chatHref}
            onNavigate={() => {
              setOpenMobile(false);
            }}
          >
            <span>{chat.title}</span>
          </IntentPrefetchLink>
        </SidebarMenuButton>
      )}

      <DropdownMenu modal={true}>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction
            className="mr-0.5 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            showOnHover={!isActive}
          >
            <MoreHorizontal size={16} />
            <span className="sr-only">More</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" side="bottom">
          <ChatMenuItems
            isPinned={chat.isPinned}
            onDelete={() => onDelete(chat.id)}
            onRename={() => {
              setIsEditing(true);
              setEditTitle(chat.title);
            }}
            onShare={() => setShareDialogOpen(true)}
            onTogglePin={() => onPin(chat.id, !chat.isPinned)}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      {shareDialogOpen && (
        <ShareDialog
          chatId={chat.id}
          onOpenChange={setShareDialogOpen}
          open={shareDialogOpen}
        />
      )}
    </SidebarMenuItem>
  );
};

export const SidebarChatItem = memo(
  PureSidebarChatItem,
  (prevProps, nextProps) => {
    if (prevProps.isActive !== nextProps.isActive) {
      return false;
    }
    if (prevProps.eagerPrefetch !== nextProps.eagerPrefetch) {
      return false;
    }
    if (prevProps.chat.id !== nextProps.chat.id) {
      return false;
    }
    if (prevProps.chat.title !== nextProps.chat.title) {
      return false;
    }
    if (prevProps.chat.isPinned !== nextProps.chat.isPinned) {
      return false;
    }
    return true;
  }
);
