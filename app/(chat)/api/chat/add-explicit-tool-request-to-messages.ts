import type { ChatMessage, ToolName } from "@/lib/ai/types";

function buildToolInstruction(toolsToRequest: ToolName[]): string {
  if (toolsToRequest.length === 1 && toolsToRequest[0] === "leanProof") {
    return [
      "I want to use the math agent for this problem.",
      "First call the formal proof submission tool with:",
      '- "prompt": the full natural-language math problem or theorem statement,',
      '- "mode": "formalize_and_prove".',
      "Do not include Lean code, theorem names, or sandbox instructions in the tool input.",
      "Stop after the tool returns the jobId and queued status.",
      "Do not call the status-check tool in the same response.",
    ].join(" ");
  }

  if (
    toolsToRequest.length === 1 &&
    toolsToRequest[0] === "aristotleCheckJob"
  ) {
    return [
      "I want to check the math agent job.",
      "Call the status-check tool with the existing jobId.",
      "If you need the final Lean code, set waitForCompletion to true.",
    ].join(" ");
  }

  return `I want to use the tools ${toolsToRequest.join(", or ")}`;
}

export function addExplicitToolRequestToMessages(
  messages: ChatMessage[],
  explicitlyRequestedTools: ToolName[] | null
) {
  const lastAssistantMessage = messages.findLast(
    (message) => message.role === "assistant"
  );

  const lastMessage = messages.at(-1);
  if (!lastMessage) {
    return;
  }
  let toolsToRequest: ToolName[] = [];

  if (explicitlyRequestedTools) {
    // 1. Explicitly requested tools
    toolsToRequest = explicitlyRequestedTools;
  } else if (
    lastAssistantMessage?.parts &&
    lastAssistantMessage.parts.length > 0
  ) {
    // 2. Unfinished deep research if it's unfinished
    for (const part of lastAssistantMessage.parts) {
      if (
        part.type === "tool-deepResearch" &&
        part.state === "output-available" &&
        part.output.format === "clarifying_questions"
      ) {
        toolsToRequest = ["deepResearch"];
        break; // Found it, no need to continue looping
      }
    }
  }

  if (toolsToRequest.length > 0 && lastMessage) {
    lastMessage.parts.push({
      type: "text",
      text: buildToolInstruction(toolsToRequest),
    });
  }
}
