"use client";

import { useEffect, useState } from "react";
import { ShimmerText } from "@/components/shimmer-text";

function formatElapsed(ms: number): string {
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

function toTimestamp(value: Date | string | number): number {
  if (typeof value === "number") {
    return value;
  }

  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  return Number.isFinite(timestamp) ? timestamp : Date.now();
}

export function LoadingStatus({
  className,
  label,
  startedAt,
}: {
  className?: string;
  label: string;
  startedAt: Date | number | string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const elapsedText = formatElapsed(Math.max(0, now - toTimestamp(startedAt)));

  return (
    <div className={`flex items-center gap-2 py-2 text-sm ${className ?? ""}`}>
      <span className="font-semibold text-foreground/90 tabular-nums">
        {elapsedText}
      </span>
      <ShimmerText
        className="font-semibold text-muted-foreground"
        delay={0}
        duration={1.2}
      >
        {label}
      </ShimmerText>
    </div>
  );
}
