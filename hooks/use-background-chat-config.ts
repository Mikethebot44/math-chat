"use client";

import { useSession } from "@/providers/session-provider";

export function useBackgroundChatConfig() {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;

  return {
    backgroundChatEnabled: false,
    isAuthenticated,
    isRuntimeConfigResolved: true,
  };
}
