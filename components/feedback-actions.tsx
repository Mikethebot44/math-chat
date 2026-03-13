import { useMessageById } from "@ai-sdk-tools/store";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { File, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { useArtifact } from "@/hooks/use-artifact";
import type { ChatMessage } from "@/lib/ai/types";
import type { Vote } from "@/lib/db/schema";
import {
  useAristotleLeanDownloadData,
  useAristotleThoughtDurationMs,
  useMessageHasAristotleContext,
} from "@/lib/stores/hooks-base";
import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";
import { MessageAction as Action } from "./ai-elements/message";
import { RetryButton } from "./retry-button";
import { Tag } from "./tag";

function formatElapsedDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

export function FeedbackActions({
  chatId,
  messageId,
  vote,
  isReadOnly,
}: {
  chatId: string;
  messageId: string;
  vote: Vote | undefined;
  isReadOnly: boolean;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const isAuthenticated = !!session?.user;

  const voteMessageMutation = useMutation(
    trpc.vote.voteMessage.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.vote.getVotes.queryKey({ chatId }),
        });
      },
    })
  );

  if (isReadOnly) {
    return null;
  }

  return (
    <>
      {isAuthenticated ? (
        <>
          <Action
            className="pointer-events-auto! h-7 w-7 p-0 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            data-testid="message-downvote"
            disabled={vote && !vote.isUpvoted}
            onClick={() => {
              toast.promise(
                voteMessageMutation.mutateAsync({
                  chatId,
                  messageId,
                  type: "down" as const,
                }),
                {
                  loading: "Downvoting Response...",
                  success: "Downvoted Response!",
                  error: "Failed to downvote response.",
                }
              );
            }}
            tooltip="Downvote Response"
          >
            <ThumbsDown size={14} />
          </Action>

          <Action
            className="pointer-events-auto! h-7 w-7 p-0 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            data-testid="message-upvote"
            disabled={vote?.isUpvoted}
            onClick={() => {
              toast.promise(
                voteMessageMutation.mutateAsync({
                  chatId,
                  messageId,
                  type: "up" as const,
                }),
                {
                  loading: "Upvoting Response...",
                  success: "Upvoted Response!",
                  error: "Failed to upvote response.",
                }
              );
            }}
            tooltip="Upvote Response"
          >
            <ThumbsUp size={14} />
          </Action>
        </>
      ) : null}

      <RetryButton messageId={messageId} />
      <SelectedModelId messageId={messageId} />
    </>
  );
}

function SelectedModelId({ messageId }: { messageId: string }) {
  const message = useMessageById<ChatMessage>(messageId);
  const leanDownloadData = useAristotleLeanDownloadData(messageId);
  const thoughtDurationMs = useAristotleThoughtDurationMs(messageId);
  const hasAristotleContext = useMessageHasAristotleContext(messageId);
  const { setArtifact } = useArtifact();

  if (typeof thoughtDurationMs === "number") {
    return (
      <div className="ml-2 flex items-center gap-2">
        <span className="font-semibold text-muted-foreground text-sm">
          Thought for {formatElapsedDuration(thoughtDurationMs)}
        </span>
        {leanDownloadData ? (
          <Action
            className="h-7 gap-1.5 px-2 font-medium text-muted-foreground text-xs hover:bg-accent hover:text-accent-foreground"
            label="Open Lean"
            onClick={() => {
              setArtifact({
                content: leanDownloadData.code,
                date: new Date().toISOString(),
                documentId: "init",
                isVisible: true,
                kind: "code",
                messageId,
                status: "idle",
                title: leanDownloadData.title,
              });
            }}
            size="sm"
            tooltip="Open Lean file"
            variant="ghost"
          >
            <File size={14} />
            Open Lean
          </Action>
        ) : null}
      </div>
    );
  }

  if (hasAristotleContext && !leanDownloadData) {
    return null;
  }

  return message?.metadata?.selectedModel ? (
    <div className="ml-2 flex items-center">
      <Tag>{message.metadata.selectedModel}</Tag>
    </div>
  ) : null;
}
