"use server";

import { generateText } from "ai";
import { getLanguageModel } from "@/lib/ai/providers";
import { DEFAULT_SCOUT_MODEL_ID } from "@/lib/ai/scout-models";
import type { ChatMessage } from "@/lib/ai/types";

export async function generateTitleFromUserMessage({
	message,
}: {
	message: ChatMessage;
}) {
	const { text: title } = await generateText({
		model: await getLanguageModel(DEFAULT_SCOUT_MODEL_ID),
		system: `Generate a concise title for a chat conversation based on the user's first message.

Rules (strictly follow all):
- Maximum 40 characters — hard limit, never exceed this
- 3-6 words is ideal
- No quotes, colons, or punctuation at the end
- No filler words like "How to" or "Question about"
- Use title case
- Return ONLY the title, nothing else`,
		prompt: JSON.stringify(message),
		experimental_telemetry: { isEnabled: true },
	});

	return title;
}
