import { config } from "@/lib/config";
import type { ToolName, UiToolName } from "./types";

export const DEFAULT_CHAT_TOOL: UiToolName | null = config.ai.tools.leanProof
  .enabled
  ? "leanProof"
  : null;

export const ALWAYS_ENABLED_MATH_AGENT_TOOLS: ToolName[] =
  config.ai.tools.leanProof.enabled
    ? ["leanProof", "aristotleCheckJob"]
    : [];
