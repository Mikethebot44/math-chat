"use client";

import { GitBranchIcon } from "lucide-react";
import { useChatModels } from "@/providers/chat-models-provider";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

function formatTokenCount(value: number): string {
  if (value >= 1_000_000) {
    return `${Math.round(value / 100_000) / 10}M`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 100) / 10}K`;
  }
  return value.toString();
}

export function ContextUsageFromParent({
  className,
  iconOnly = false,
  parentMessageId,
  selectedModelId,
}: {
  className?: string;
  iconOnly?: boolean;
  parentMessageId: string | null;
  selectedModelId: string;
}) {
  const { getModelById } = useChatModels();
  const model = getModelById(selectedModelId);

  if (!parentMessageId || !model?.context_window) {
    return null;
  }

  const formattedContextWindow = formatTokenCount(model.context_window);
  const label = `${formattedContextWindow} ctx`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "inline-flex h-8 items-center gap-1 rounded-md border border-border/60 bg-background px-2 text-muted-foreground text-xs",
            className
          )}
        >
          <GitBranchIcon className="size-3.5" />
          {!iconOnly ? <span>{label}</span> : null}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {`Replying in thread. ${model.name} supports up to ${formattedContextWindow} tokens of context.`}
      </TooltipContent>
    </Tooltip>
  );
}
