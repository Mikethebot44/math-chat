import { generateText } from "ai";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { z } from "zod";
import type { AppModelId } from "@/lib/ai/app-models";
import {
  ARISTOTLE_LOADING_LINE_COUNT,
  buildFallbackAristotleLoadingLines,
  finalizeAristotleLoadingLines,
  normalizeAristotlePrompt,
} from "@/lib/ai/tools/lean-proof/aristotle-loading-lines";
import { getLanguageModel, getModelProviderOptions } from "@/lib/ai/providers";
import { SCOUT_MODEL_IDS } from "@/lib/ai/scout-models";
import { getAnonymousSession } from "@/lib/anonymous-session-server";
import { auth } from "@/lib/auth";
import { config } from "@/lib/config";
import { getChatById } from "@/lib/db/queries";
import { getRedisClient } from "@/lib/redis";

const requestSchema = z.object({
  messageId: z.string().min(1),
  prompt: z.string().min(1).max(1000),
});

const ARISTOTLE_LOADING_MODEL_ID =
  SCOUT_MODEL_IDS.SCOUT_INSTANT satisfies AppModelId;
const ARISTOTLE_LOADING_LINE_CACHE_TTL_SECONDS = 24 * 60 * 60;

const cachedResponseSchema = z.object({
  lines: z.array(z.string()).length(ARISTOTLE_LOADING_LINE_COUNT),
  source: z.enum(["fallback", "generated"]),
});

function parseGeneratedLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chatId } = await params;
  const body = await request.json();
  const parsedRequest = requestSchema.safeParse(body);

  if (!parsedRequest.success) {
    return Response.json({ error: "Invalid prompt" }, { status: 400 });
  }

  const { messageId } = parsedRequest.data;
  const prompt = normalizeAristotlePrompt(parsedRequest.data.prompt);
  if (!prompt) {
    return Response.json({ error: "Invalid prompt" }, { status: 400 });
  }

  const [session, anonymousSession, chat] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    getAnonymousSession(),
    getChatById({ id: chatId }),
  ]);

  if (!chat) {
    return Response.json({ error: "Chat not found" }, { status: 404 });
  }

  const viewerId = session?.user?.id ?? anonymousSession?.id ?? null;
  if (chat.visibility !== "public" && chat.userId !== viewerId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const redis = await getRedisClient();
  const cacheKey = `${config.appPrefix}:aristotle-loading-lines:${chatId}:${messageId}`;

  if (redis) {
    try {
      const cachedValue = await redis.get(cacheKey);
      if (cachedValue) {
        const parsedCachedValue = cachedResponseSchema.safeParse(
          JSON.parse(cachedValue)
        );

        if (parsedCachedValue.success) {
          return Response.json(parsedCachedValue.data);
        }
      }
    } catch (error) {
      console.error("Failed to read Aristotle loading lines cache", error);
    }
  }

  try {
    const result = await generateText({
      model: await getLanguageModel(ARISTOTLE_LOADING_MODEL_ID),
      providerOptions: await getModelProviderOptions(
        ARISTOTLE_LOADING_MODEL_ID
      ),
      system: `You write compact loading labels for a math UI while a proof tool is still running.

Return exactly ${ARISTOTLE_LOADING_LINE_COUNT} short status labels about the user's prompt.

Rules:
- Each line must be a short phrase, ideally 3 to 8 words.
- Each line must refer to the user's actual problem, not be generic.
- Start each line with a present-participle verb.
- Good examples: "Researching sum of two even numbers", "Checking finite subgroup cases", "Formalizing the cyclicity claim".
- Use plain text only.
- No numbering, no quotes, no markdown, no emojis.
- Do not mention AI, models, tokens, or tools.
- Return one label per line and nothing else.`,
      prompt: `User prompt: ${prompt}`,
      maxOutputTokens: 180,
      experimental_telemetry: {
        isEnabled: true,
        functionId: "aristotle-loading-lines",
      },
    });
    const parsedLines = parseGeneratedLines(result.text);

    if (parsedLines.length === 0) {
      const fallbackResponse = {
        source: "fallback",
        lines: buildFallbackAristotleLoadingLines(prompt),
      } as const;

      if (redis) {
        try {
          await redis.set(
            cacheKey,
            JSON.stringify(fallbackResponse),
            { EX: ARISTOTLE_LOADING_LINE_CACHE_TTL_SECONDS }
          );
        } catch (error) {
          console.error("Failed to write Aristotle loading lines cache", error);
        }
      }

      return Response.json(fallbackResponse);
    }

    const generatedResponse = {
      source: "generated",
      lines: finalizeAristotleLoadingLines({
        lines: parsedLines,
        prompt,
      }),
    } as const;

    if (redis) {
      try {
        await redis.set(
          cacheKey,
          JSON.stringify(generatedResponse),
          { EX: ARISTOTLE_LOADING_LINE_CACHE_TTL_SECONDS }
        );
      } catch (error) {
        console.error("Failed to write Aristotle loading lines cache", error);
      }
    }

    return Response.json(generatedResponse);
  } catch (error) {
    console.error("Failed to generate Aristotle loading lines", error);

    const fallbackResponse = {
      source: "fallback",
      lines: buildFallbackAristotleLoadingLines(prompt),
    } as const;

    if (redis) {
      try {
        await redis.set(
          cacheKey,
          JSON.stringify(fallbackResponse),
          { EX: ARISTOTLE_LOADING_LINE_CACHE_TTL_SECONDS }
        );
      } catch (cacheError) {
        console.error("Failed to write Aristotle loading lines cache", cacheError);
      }
    }

    return Response.json(fallbackResponse);
  }
}
