"use client";

import { LoadingStatus } from "@/components/loading-status";
import { useMessagePartTypesById } from "@/lib/stores/hooks-message-parts";
import {
  useChatBusyState,
  useMessageMetadataById,
  useOriginUserCreatedAtByMessageId,
} from "@/lib/stores/hooks-base";
import { useLatestRunStatusPart } from "@/lib/stores/hooks-message-parts";

export function PartialMessageLoading({ messageId }: { messageId: string }) {
  const metadata = useMessageMetadataById(messageId);
  const originUserCreatedAt = useOriginUserCreatedAtByMessageId(messageId);
  const partTypes = useMessagePartTypesById(messageId);
  const runStatusPart = useLatestRunStatusPart(messageId);
  const { isBusy } = useChatBusyState();
  const hasRenderableContent = partTypes.some(
    (type) => !type.startsWith("data-") && type !== "reasoning"
  );
  const isLoading = isBusy && !hasRenderableContent;

  if (!isLoading) {
    return null;
  }

  const label = runStatusPart?.data.label ?? "Thinking...";
  const startedAt =
    originUserCreatedAt ?? runStatusPart?.data.startedAt ?? metadata.createdAt;

  return <LoadingStatus label={label} startedAt={startedAt} />;
}
