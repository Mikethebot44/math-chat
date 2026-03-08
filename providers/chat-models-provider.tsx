"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";
import type { AppModelDefinition } from "@/lib/ai/app-models";

interface ChatModelsContextType {
  allModels: AppModelDefinition[];
  getModelById: (modelId: string) => AppModelDefinition | undefined;
  models: AppModelDefinition[];
}

const ChatModelsContext = createContext<ChatModelsContextType | undefined>(
  undefined
);

export function ChatModelsProvider({
  children,
  models,
}: {
  children: ReactNode;
  models: AppModelDefinition[];
}) {
  const allModelsMap = useMemo(() => {
    const map = new Map<string, AppModelDefinition>();
    for (const model of models) {
      map.set(model.id, model);
    }
    return map;
  }, [models]);

  return (
    <ChatModelsContext.Provider
      value={{
        models,
        allModels: models,
        getModelById: (modelId: string) => allModelsMap.get(modelId),
      }}
    >
      {children}
    </ChatModelsContext.Provider>
  );
}

export function useChatModels() {
  const context = useContext(ChatModelsContext);
  if (context === undefined) {
    throw new Error("useChatModels must be used within a ChatModelsProvider");
  }
  return context;
}
