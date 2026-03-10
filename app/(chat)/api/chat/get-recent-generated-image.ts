import type { ChatMessage } from "@/lib/ai/types";

export function getRecentGeneratedImage(
  messages: ChatMessage[]
): { imageUrl: string; name: string } | null {
  const lastAssistantMessage = messages.findLast(
    (message) => message.role === "assistant"
  );

  if (lastAssistantMessage?.parts && lastAssistantMessage.parts.length > 0) {
    for (const part of lastAssistantMessage.parts) {
      if (part.type !== "tool-generateImage") {
        continue;
      }

      const output = part.output as Record<string, unknown> | undefined;
      const imageUrl =
        typeof output?.imageUrl === "string" ? output.imageUrl : null;

      if (imageUrl) {
        return {
          imageUrl,
          name: `generated-image-${part.toolCallId}.png`,
        };
      }
    }
  }

  return null;
}
