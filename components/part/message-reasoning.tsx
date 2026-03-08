"use client";
import { memo } from "react";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { useMessageHasAristotleContext } from "@/lib/stores/hooks-base";

interface MessageReasoningProps {
  content: string;
  isLoading: boolean;
  messageId: string;
}

function PureReasoningPart({
  isLoading,
  content,
  messageId,
}: MessageReasoningProps) {
  const hideReasoning = useMessageHasAristotleContext(messageId);

  if (hideReasoning) {
    return null;
  }

  return (
    <Reasoning className="mb-2" isStreaming={isLoading}>
      <ReasoningTrigger data-testid="message-reasoning-toggle" />
      <ReasoningContent data-testid="message-reasoning">
        {content}
      </ReasoningContent>
    </Reasoning>
  );
}

export const ReasoningPart = memo(PureReasoningPart);
