import type { ChatMessage } from "@/lib/ai/types";
import { AristotleLoader } from "./aristotle-loader";

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
  return <AristotleLoader messageId={messageId} tool={tool} />;
}
