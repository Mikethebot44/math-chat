import type { ChatMessage } from "@/lib/ai/types";
import { AristotleLoader } from "./aristotle-loader";

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
  return <AristotleLoader messageId={messageId} tool={tool} />;
}
