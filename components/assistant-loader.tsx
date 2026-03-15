"use client";

import type { ReactNode } from "react";
import { Loader } from "@/components/loader";
import { cn } from "@/lib/utils";

const DEFAULT_ASSISTANT_LABEL = "Thinking...";

export function AssistantLoader({
  className,
  label,
  subtitle,
}: {
  className?: string;
  label?: string;
  subtitle?: ReactNode | null;
}) {
  const resolvedSubtitle = subtitle ?? null;

  return (
    <div data-testid="message-assistant-loading">
      <Loader
        className={cn("min-h-[240px] px-0", className)}
        label={label ?? DEFAULT_ASSISTANT_LABEL}
        labelShimmer
        subtitle={resolvedSubtitle}
      />
    </div>
  );
}
