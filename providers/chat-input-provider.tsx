"use client";

import React, {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { LexicalChatInputRef } from "@/components/lexical-chat-input";
import type { AppModelId } from "@/lib/ai/app-models";
import { DEFAULT_SCOUT_MODEL_ID } from "@/lib/ai/scout-models";
import type { Attachment, UiToolName } from "@/lib/ai/types";
import { config } from "@/lib/config";

const DEFAULT_CHAT_TOOL: UiToolName | null = config.ai.tools.leanProof.enabled
  ? "leanProof"
  : null;

interface ChatInputContextType {
  attachments: Attachment[];
  editorRef: React.RefObject<LexicalChatInputRef | null>;
  getInitialInput: () => string;
  getInputValue: () => string;
  handleInputChange: (value: string) => void;
  handleModelChange: (modelId: AppModelId) => Promise<void>;
  handleSubmit: (submitFn: () => void, isEditMode?: boolean) => void;
  isEmpty: boolean;
  isProjectContext: boolean;
  selectedModelId: AppModelId;
  selectedTool: UiToolName | null;
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  setSelectedTool: Dispatch<SetStateAction<UiToolName | null>>;
}

const ChatInputContext = createContext<ChatInputContextType | undefined>(
  undefined
);

interface ChatInputProviderProps {
  children: ReactNode;
  initialAttachments?: Attachment[];
  initialInput?: string;
  initialTool?: UiToolName | null;
  isProjectContext?: boolean;
  localStorageEnabled?: boolean;
  overrideModelId?: AppModelId; // For message editing where we want to use the original model
}

export function ChatInputProvider({
  children,
  initialInput = "",
  initialTool = DEFAULT_CHAT_TOOL,
  initialAttachments = [],
  overrideModelId: _overrideModelId,
  localStorageEnabled = true,
  isProjectContext = false,
}: ChatInputProviderProps) {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  // Helper functions for localStorage access without state
  const getLocalStorageInput = useCallback(() => {
    if (!localStorageEnabled) {
      return "";
    }
    try {
      return localStorage.getItem("input") || "";
    } catch {
      return "";
    }
  }, [localStorageEnabled]);

  const setLocalStorageInput = useCallback(
    (value: string) => {
      if (!localStorageEnabled) {
        return;
      }
      try {
        localStorage.setItem("input", value);
      } catch {
        // Silently fail if localStorage is not available
      }
    },
    [localStorageEnabled]
  );

  const selectedModelId = DEFAULT_SCOUT_MODEL_ID;

  // IMPORTANT: do not read localStorage during initial render.
  // Next SSRs client components; localStorage is client-only and will cause hydration mismatches
  // (e.g., submit button `disabled` stuck from server HTML).
  const inputValueRef = useRef<string>(initialInput);

  const [selectedTool, setSelectedTool] = useState<UiToolName | null>(
    initialTool ?? DEFAULT_CHAT_TOOL
  );
  const [attachments, setAttachments] =
    useState<Attachment[]>(initialAttachments);

  // Track if input is empty for reactive UI updates
  const [isEmpty, setIsEmpty] = useState<boolean>(
    () => initialInput.trim().length === 0
  );

  // Create ref for lexical editor
  const editorRef = useRef<LexicalChatInputRef | null>(null);

  // Get the initial input value from localStorage if enabled and no initial input provided
  const getInitialInput = useCallback(() => {
    if (!localStorageEnabled) {
      return initialInput;
    }
    if (!hasHydrated) {
      return initialInput;
    }
    return initialInput || getLocalStorageInput();
  }, [initialInput, getLocalStorageInput, localStorageEnabled, hasHydrated]);

  const handleModelChange = useCallback(
    async (_modelId: AppModelId) => {},
    []
  );

  const clearInput = useCallback(() => {
    editorRef.current?.clear();
    setLocalStorageInput("");
    inputValueRef.current = "";
    setIsEmpty(true);
  }, [setLocalStorageInput]);

  const resetData = useCallback(() => {
    setSelectedTool(DEFAULT_CHAT_TOOL);
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  const getInputValue = useCallback(() => inputValueRef.current, []);

  // Save to localStorage when input changes (will be called by the lexical editor)
  const handleInputChange = useCallback(
    (value: string) => {
      if (localStorageEnabled) {
        setLocalStorageInput(value);
      }
      inputValueRef.current = value;
      // Update isEmpty state reactively
      setIsEmpty(value.trim().length === 0);
    },
    [setLocalStorageInput, localStorageEnabled]
  );

  // Unified submit handler that ensures consistent behavior for both Enter key and send button
  const handleSubmit = useCallback(
    (submitFn: () => void, isEditMode = false) => {
      // Call the actual submission function
      submitFn();

      // Clear attachments for all submissions
      clearAttachments();

      // Clear input only when not in edit mode
      if (!isEditMode) {
        clearInput();
      }

      // deepResearch stays active until the research process completes (handled via DataStreamHandler)
      if (selectedTool !== "deepResearch") {
        resetData();
      }
    },
    [clearAttachments, clearInput, selectedTool, resetData]
  );

  return (
    <ChatInputContext.Provider
      value={{
        editorRef,
        selectedTool,
        setSelectedTool,
        attachments,
        setAttachments,
        selectedModelId,
        handleModelChange,
        getInputValue,
        handleInputChange,
        getInitialInput,
        isEmpty,
        handleSubmit,
        isProjectContext,
      }}
    >
      {children}
    </ChatInputContext.Provider>
  );
}

export function useChatInput() {
  const context = useContext(ChatInputContext);
  if (context === undefined) {
    throw new Error("useChatInput must be used within a ChatInputProvider");
  }
  return context;
}
