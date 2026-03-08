"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";

export function useBackgroundChatConfig() {
  const { data: session } = useSession();
  const trpc = useTRPC();
  const isAuthenticated = !!session?.user;
  const { data: runtimeConfig } = useQuery({
    ...trpc.chat.getRuntimeConfig.queryOptions(),
    enabled: isAuthenticated,
    staleTime: Number.POSITIVE_INFINITY,
  });

  return {
    backgroundChatEnabled:
      isAuthenticated && runtimeConfig?.backgroundChatEnabled === true,
    isAuthenticated,
    isRuntimeConfigResolved: !isAuthenticated || runtimeConfig !== undefined,
  };
}
