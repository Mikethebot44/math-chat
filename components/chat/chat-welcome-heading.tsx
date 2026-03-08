"use client";

import { GradientWaveText } from "@/components/ui/gradient-wave-text";

export function ChatWelcomeHeading() {
  return (
    <GradientWaveText
      ariaLabel="How can I help you today?"
      bottomOffset={0}
      className="pointer-events-none text-center font-normal text-2xl sm:text-3xl"
      speed={0.9}
    >
      How can I help you today?
    </GradientWaveText>
  );
}
