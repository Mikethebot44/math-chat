import type { ChatMessage } from "@/lib/ai/types";
import { AristotleThinkingStatus } from "./aristotle-thinking-status";

type AristotleCheckJobTool = Extract<
  ChatMessage["parts"][number],
  { type: "tool-aristotleCheckJob" }
>;
export function AristotleJobStatus({
  messageId,
  tool,
}: {
  messageId: string;
  tool: AristotleCheckJobTool;
}) {
  return <AristotleThinkingStatus messageId={messageId} tool={tool} />;
}
