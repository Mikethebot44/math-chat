"use client";

import { AssistantLoader } from "@/components/assistant-loader";
import { useMessagePartTypesById } from "@/lib/stores/hooks-message-parts";
import { useChatBusyState } from "@/lib/stores/hooks-base";
import { useLatestRunStatusPart } from "@/lib/stores/hooks-message-parts";

export function PartialMessageLoading({ messageId }: { messageId: string }) {
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

  const label =
    typeof runStatusPart?.data.label === "string" &&
    runStatusPart.data.label.trim().length > 0
      ? runStatusPart.data.label
      : undefined;

  return <AssistantLoader label={label} />;
}
