import { config } from "../config";
import { ALWAYS_ENABLED_MATH_AGENT_TOOLS } from "./math-agent";
import type { ChatTools, ToolName } from "./types";

/**
 * Maps a selected tool (from UI) to the list of tool names that should be explicitly requested.
 * This is the single source of truth for explicit tool mapping.
 */

export function hasExplicitToolRestriction(
  explicitlyRequestedTools: ToolName[] | null
): explicitlyRequestedTools is ToolName[] {
  return explicitlyRequestedTools !== null;
}

export function determineExplicitlyRequestedTools(
  selectedTool: keyof ChatTools | null
): ToolName[] | null {
  if (!selectedTool) {
    return ALWAYS_ENABLED_MATH_AGENT_TOOLS.length > 0
      ? ALWAYS_ENABLED_MATH_AGENT_TOOLS
      : null;
  }
  if (selectedTool === "deepResearch") {
    return ["deepResearch"];
  }
  if (selectedTool === "webSearch") {
    return ["webSearch"];
  }
  if (selectedTool === "generateImage") {
    return ["generateImage"];
  }
  if (selectedTool === "leanProof") {
    return ALWAYS_ENABLED_MATH_AGENT_TOOLS;
  }
  if (selectedTool === "createTextDocument") {
    if (!config.features.sandbox) {
      return [];
    }
    return [
      "createTextDocument",
      "createCodeDocument",
      "createSheetDocument",
      "editTextDocument",
      "editCodeDocument",
      "editSheetDocument",
    ];
  }
  return null;
}
