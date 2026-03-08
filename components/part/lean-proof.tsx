import type { ChatMessage } from "@/lib/ai/types";
import { AristotleThinkingStatus } from "./aristotle-thinking-status";

type AristotleSubmitTool = Extract<
  ChatMessage["parts"][number],
  { type: "tool-leanProof" }
>;
export function LeanProof({
  messageId,
  tool,
}: {
  messageId: string;
  tool: AristotleSubmitTool;
}) {
  return <AristotleThinkingStatus messageId={messageId} tool={tool} />;
}
