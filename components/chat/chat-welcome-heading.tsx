"use client";

import { GradientWaveText } from "@/components/ui/gradient-wave-text";

export function ChatWelcomeHeading() {
  return (
    <GradientWaveText
      ariaLabel="How can I help you today?"
      bottomOffset={0}
      className="pointer-events-none text-center font-normal text-2xl [--gradient-wave-base:rgb(10,10,10)] [--welcome-wave-1:rgb(10,10,10)] [--welcome-wave-2:rgb(37,99,235)] [--welcome-wave-3:rgb(255,255,255)] sm:text-3xl dark:[--gradient-wave-base:rgb(255,255,255)] dark:[--welcome-wave-1:rgb(255,255,255)] dark:[--welcome-wave-2:rgb(96,165,250)] dark:[--welcome-wave-3:rgb(15,23,42)]"
      customColors={[
        "var(--welcome-wave-1)",
        "var(--welcome-wave-2)",
        "var(--welcome-wave-3)",
        "var(--welcome-wave-2)",
      ]}
      speed={0.9}
    >
      How can I help you today?
    </GradientWaveText>
  );
}
