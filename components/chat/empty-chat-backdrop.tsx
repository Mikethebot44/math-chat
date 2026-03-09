"use client";

import { memo } from "react";
import AnimatedGradient from "@/components/animated-gradient";
import { cn } from "@/lib/utils";

const lightBackdropConfig = {
  preset: "custom" as const,
  color1: "#f7f7f5",
  color2: "#93c5fd",
  color3: "#dbeafe",
  rotation: -4,
  proportion: 44,
  scale: 0.24,
  speed: 18,
  distortion: 2,
  swirl: 16,
  swirlIterations: 6,
  softness: 90,
  offset: -120,
  shape: "Edge" as const,
  shapeSize: 28,
};

const darkBackdropConfig = {
  preset: "custom" as const,
  color1: "#171717",
  color2: "#3b82f6",
  color3: "#1e3a8a",
  rotation: -2,
  proportion: 48,
  scale: 0.34,
  speed: 20,
  distortion: 2,
  swirl: 18,
  swirlIterations: 6,
  softness: 92,
  offset: -90,
  shape: "Edge" as const,
  shapeSize: 30,
};

export const EmptyChatBackdrop = memo(function EmptyChatBackdrop({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-0 z-0 overflow-hidden",
        className
      )}
    >
      <AnimatedGradient
        className="dark:hidden"
        config={lightBackdropConfig}
        noise={{ opacity: 0.04, scale: 0.8 }}
        style={{
          zIndex: 0,
          opacity: 0.48,
          filter: "blur(9px)",
          transform: "scale(1.03)",
        }}
      />
      <AnimatedGradient
        className="hidden dark:block"
        config={darkBackdropConfig}
        noise={{ opacity: 0.05, scale: 0.9 }}
        style={{
          zIndex: 0,
          opacity: 0.42,
          filter: "blur(11px)",
          transform: "scale(1.04)",
        }}
      />

      <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.1),transparent_42%)] dark:bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.12),transparent_46%)]" />
      <div className="absolute inset-0 z-10 bg-[linear-gradient(180deg,rgba(247,247,245,0.34)_0%,rgba(247,247,245,0.12)_28%,rgba(247,247,245,0.5)_100%)] dark:bg-[linear-gradient(180deg,rgba(23,23,23,0.22)_0%,rgba(23,23,23,0.08)_28%,rgba(23,23,23,0.46)_100%)]" />
    </div>
  );
});
