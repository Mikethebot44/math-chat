"use client";

import {
  createContext,
  type ReactNode,
  useContext,
} from "react";
import type { AppModelId } from "@/lib/ai/app-models";
import { DEFAULT_SCOUT_MODEL_ID } from "@/lib/ai/scout-models";

interface DefaultModelContextType {
  changeModel: (modelId: AppModelId) => Promise<void>;
  defaultModel: AppModelId;
}

const DefaultModelContext = createContext<DefaultModelContextType | undefined>(
  undefined
);

interface DefaultModelClientProviderProps {
  children: ReactNode;
  defaultModel: AppModelId;
}

export function DefaultModelProvider({
  children,
  defaultModel: _defaultModel,
}: DefaultModelClientProviderProps) {
  const changeModel = async (_modelId: AppModelId) => {};
  const value = {
    defaultModel: DEFAULT_SCOUT_MODEL_ID,
    changeModel,
  };

  return (
    <DefaultModelContext.Provider value={value}>
      {children}
    </DefaultModelContext.Provider>
  );
}

export function useDefaultModel() {
  const context = useContext(DefaultModelContext);
  if (context === undefined) {
    throw new Error(
      "useDefaultModel must be used within a DefaultModelProvider"
    );
  }
  return context.defaultModel;
}

export function useModelChange() {
  const context = useContext(DefaultModelContext);
  if (context === undefined) {
    throw new Error(
      "useModelChange must be used within a DefaultModelProvider"
    );
  }
  return context.changeModel;
}
