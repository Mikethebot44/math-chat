"use client";
import { useChatId, useChatStatus } from "@ai-sdk-tools/store";
import { memo } from "react";
import { config } from "@/lib/config";
import {
  useLatestAssistantChildCreatedAtByParentId,
  useMessageMetadataById,
} from "@/lib/stores/hooks-base";
import { useMessagePartTypesById } from "@/lib/stores/hooks-message-parts";
import { Message, MessageContent } from "./ai-elements/message";
import { AristotleLeanArtifactSync } from "./aristotle-lean-artifact-sync";
import { FollowUpSuggestionsParts } from "./followup-suggestions";
import { MessageActions } from "./message-actions";
import { MessageParts } from "./message-parts";
import { SourcesAnnotations } from "./part/message-annotations";
import { PartialMessageLoading } from "./partial-message-loading";
import type { BaseMessageProps } from "./user-message";

const PureAssistantMessage = ({
  messageId,
  isLoading,
  isReadonly,
}: Omit<BaseMessageProps, "parentMessageId">) => {
  const chatId = useChatId();
  const metadata = useMessageMetadataById(messageId);
  const continuationCreatedAt =
    useLatestAssistantChildCreatedAtByParentId(messageId);
  const partTypes = useMessagePartTypesById(messageId);
  const status = useChatStatus();
  const isReconnectingToMessageStream =
    metadata.activeStreamId !== null && status === "submitted";
  const hasAssistantText = partTypes.includes("text");
  const hasAristotleTool =
    partTypes.includes("tool-leanProof") ||
    partTypes.includes("tool-aristotleCheckJob");
  const shouldHideCompletedAristotleToolMessage =
    hasAristotleTool && !hasAssistantText && continuationCreatedAt !== null;

  if (
    !chatId ||
    isReconnectingToMessageStream ||
    shouldHideCompletedAristotleToolMessage
  ) {
    return null;
  }

  return (
    <Message className="w-full max-w-full items-start py-1" from="assistant">
      <MessageContent className="w-full px-0 py-0 text-left">
        <PartialMessageLoading messageId={messageId} />
        <MessageParts
          isLoading={isLoading}
          isReadonly={isReadonly}
          messageId={messageId}
        />
        <AristotleLeanArtifactSync messageId={messageId} />

        <SourcesAnnotations
          key={`sources-annotations-${messageId}`}
          messageId={messageId}
        />

        {hasAssistantText ? (
          <MessageActions
            chatId={chatId}
            isLoading={isLoading}
            isReadOnly={isReadonly}
            key={`action-${messageId}`}
            messageId={messageId}
          />
        ) : null}
        {isReadonly || !config.ai.tools.followupSuggestions.enabled ? null : (
          <FollowUpSuggestionsParts messageId={messageId} />
        )}
      </MessageContent>
    </Message>
  );
};
export const AssistantMessage = memo(
  PureAssistantMessage,
  (prevProps, nextProps) => {
    if (prevProps.messageId !== nextProps.messageId) {
      return false;
    }
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }
    if (prevProps.isReadonly !== nextProps.isReadonly) {
      return false;
    }
    return true;
  }
);
