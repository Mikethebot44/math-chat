import { convertToModelMessages, generateText } from "ai";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { filterPartsForLLM } from "@/app/(chat)/api/chat/filter-reasoning-parts";
import type { AppModelId } from "@/lib/ai/app-models";
import { systemPrompt } from "@/lib/ai/prompts";
import { getLanguageModel, getModelProviderOptions } from "@/lib/ai/providers";
import { DEFAULT_SCOUT_MODEL_ID } from "@/lib/ai/scout-models";
import {
  type AristotleJobStatusResult,
  checkAristotleJobStatus,
} from "@/lib/ai/tools/lean-proof/aristotle-client";
import type { ChatMessage } from "@/lib/ai/types";
import { getAnonymousSession } from "@/lib/anonymous-session-server";
import { auth } from "@/lib/auth";
import { CostAccumulator } from "@/lib/credits/cost-accumulator";
import { deductCredits } from "@/lib/db/credits";
import {
  getAllMessagesByChatId,
  getChatById,
  getChatMessageWithPartsById,
  getProjectById,
  saveMessage,
  updateMessage,
} from "@/lib/db/queries";
import { getUserPreferences } from "@/lib/db/user-preferences";
import { buildThreadFromLeaf } from "@/lib/thread-utils";
import { generateUUID } from "@/lib/utils";
import { replaceFilePartUrlByBinaryDataInMessages } from "@/lib/utils/download-assets";

type AristotleToolPart = Extract<
  ChatMessage["parts"][number],
  { type: "tool-leanProof" | "tool-aristotleCheckJob" }
>;

interface AristotleJobOutput {
  completed?: boolean;
  completedAt?: string;
  failed?: boolean;
  jobId?: string;
  startedAt?: string;
  status?: string;
  thoughtDurationMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getAristotleJobOutput(
  part: ChatMessage["parts"][number]
): AristotleJobOutput | null {
  if (
    (part.type !== "tool-leanProof" &&
      part.type !== "tool-aristotleCheckJob") ||
    part.state !== "output-available" ||
    !isRecord(part.output) ||
    typeof part.output.jobId !== "string"
  ) {
    return null;
  }

  return part.output as AristotleJobOutput;
}

function findAristotleToolPart(message: ChatMessage): AristotleToolPart | null {
  for (const part of message.parts) {
    const output = getAristotleJobOutput(part);
    if (output) {
      return part as AristotleToolPart;
    }
  }

  return null;
}

function updateAristotleToolOutput({
  defaultStartedAt,
  previousOutput,
  snapshot,
}: {
  defaultStartedAt: string;
  previousOutput: AristotleJobOutput;
  snapshot: AristotleJobStatusResult;
}): AristotleJobStatusResult {
  const startedAt =
    typeof previousOutput.startedAt === "string"
      ? previousOutput.startedAt
      : defaultStartedAt;
  let completedAt = previousOutput.completedAt;

  if (
    typeof completedAt !== "string" &&
    (snapshot.completed || snapshot.failed)
  ) {
    completedAt = new Date().toISOString();
  }

  let thoughtDurationMs = previousOutput.thoughtDurationMs;

  if (typeof thoughtDurationMs !== "number" && completedAt) {
    thoughtDurationMs = Math.max(
      0,
      new Date(completedAt).getTime() - new Date(startedAt).getTime()
    );
  }

  return {
    ...snapshot,
    completedAt,
    startedAt,
    thoughtDurationMs,
  };
}

function updateAristotleMessage({
  message,
  snapshot,
}: {
  message: ChatMessage;
  snapshot: AristotleJobStatusResult;
}): ChatMessage {
  const defaultStartedAt = new Date(message.metadata.createdAt).toISOString();

  return {
    ...message,
    parts: message.parts.map((part) => {
      if (
        (part.type === "tool-leanProof" ||
          part.type === "tool-aristotleCheckJob") &&
        part.state === "output-available" &&
        isRecord(part.output) &&
        part.output.jobId === snapshot.jobId
      ) {
        const previousOutput = part.output as AristotleJobOutput;

        return {
          ...part,
          output: updateAristotleToolOutput({
            defaultStartedAt,
            previousOutput,
            snapshot,
          }),
        };
      }

      return part;
    }),
  };
}

function findExistingContinuationMessage({
  messages,
  sourceMessageId,
}: {
  messages: ChatMessage[];
  sourceMessageId: string;
}): ChatMessage | null {
  const matches = messages
    .filter(
      (message) =>
        message.role === "assistant" &&
        message.metadata.parentMessageId === sourceMessageId
    )
    .sort(
      (a, b) =>
        new Date(a.metadata.createdAt).getTime() -
        new Date(b.metadata.createdAt).getTime()
    );

  return matches.at(-1) ?? null;
}

async function getSystemPromptForChat({
  chatId,
  chatOwnerUserId,
}: {
  chatId: string;
  chatOwnerUserId: string | null;
}): Promise<string> {
  const userPreferences = chatOwnerUserId
    ? await getUserPreferences({ userId: chatOwnerUserId })
    : null;
  let system = systemPrompt({ userPreferences });
  const chat = await getChatById({ id: chatId });
  if (chat?.projectId) {
    const project = await getProjectById({ id: chat.projectId });
    if (project?.instructions) {
      system = `${system}\n\nProject instructions:\n${project.instructions}`;
    }
  }
  return system;
}

async function generateContinuationMessage({
  chatId,
  chatOwnerUserId,
  sourceMessage,
  selectedModelId,
  snapshot,
  userId,
}: {
  chatId: string;
  chatOwnerUserId: string | null;
  sourceMessage: ChatMessage;
  selectedModelId: AppModelId;
  snapshot: AristotleJobStatusResult;
  userId: string | null;
}): Promise<ChatMessage> {
  const allMessages = await getAllMessagesByChatId({ chatId });
  const updatedMessages = allMessages.map((message) =>
    message.id === sourceMessage.id ? sourceMessage : message
  );
  const thread = buildThreadFromLeaf(updatedMessages, sourceMessage.id).slice(
    -5
  );

  const continuationPrompt = snapshot.failed
    ? [
        `The formal proof job ${snapshot.jobId} has finished with an error.`,
        "Continue the conversation for the user.",
        "Explain briefly that the tool returned invalid Lean output.",
        "Summarize the failure in plain English and suggest a next step.",
        "Do not call any tools in this response.",
      ].join(" ")
    : [
        `The formal proof job ${snapshot.jobId} has completed.`,
        "Continue the conversation for the user.",
        "Summarize the result and mention that the Lean code is available in the tool output.",
        "Do not invent Lean code beyond what the tool returned.",
        "Do not call any tools in this response.",
      ].join(" ");

  const continuationRequest: ChatMessage = {
    id: generateUUID(),
    role: "user",
    parts: [{ type: "text", text: continuationPrompt }],
    metadata: {
      createdAt: new Date(),
      parentMessageId: sourceMessage.id,
      selectedModel: selectedModelId,
      activeStreamId: null,
    },
  };

  const filteredMessages = filterPartsForLLM(
    [...thread, continuationRequest].slice(-5)
  );
  const modelMessages = await convertToModelMessages(filteredMessages, {
    convertDataPart: (): undefined => undefined,
  });
  const contextForLLM =
    await replaceFilePartUrlByBinaryDataInMessages(modelMessages);

  const [model, providerOptions, system] = await Promise.all([
    getLanguageModel(selectedModelId),
    getModelProviderOptions(selectedModelId),
    getSystemPromptForChat({ chatId, chatOwnerUserId }),
  ]);

  const result = await generateText({
    model,
    system,
    messages: contextForLLM,
    providerOptions,
    experimental_telemetry: {
      isEnabled: true,
      functionId: "aristotle-continuation",
    },
  });

  const costAccumulator = new CostAccumulator();
  if (result.usage) {
    costAccumulator.addLLMCost(
      selectedModelId,
      result.usage,
      "aristotle-continuation"
    );
  }

  const continuationMessage: ChatMessage = {
    id: generateUUID(),
    role: "assistant",
    parts: [{ type: "text", text: result.text }],
    metadata: {
      createdAt: new Date(),
      parentMessageId: sourceMessage.id,
      selectedModel: selectedModelId,
      activeStreamId: null,
      usage: result.usage,
    },
  };

  await saveMessage({
    id: continuationMessage.id,
    chatId,
    message: continuationMessage,
  });

  if (userId) {
    await deductCredits(userId, await costAccumulator.getTotalCost());
  }

  return continuationMessage;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chatId } = await params;
  const { messageId }: { messageId?: string } = await request.json();

  if (!messageId) {
    return Response.json({ error: "messageId is required" }, { status: 400 });
  }

  const [session, anonymousSession, chat, source] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    getAnonymousSession(),
    getChatById({ id: chatId }),
    getChatMessageWithPartsById({ id: messageId }),
  ]);

  if (!(chat && source) || source.chatId !== chatId) {
    return Response.json(
      { error: "Chat or message not found" },
      { status: 404 }
    );
  }

  const viewerId = session?.user?.id ?? anonymousSession?.id ?? null;
  if (chat.visibility !== "public" && chat.userId !== viewerId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const aristotlePart = findAristotleToolPart(source.message);
  const output = aristotlePart ? getAristotleJobOutput(aristotlePart) : null;
  if (!(aristotlePart && output?.jobId)) {
    return Response.json(
      { error: "No Aristotle job found on the source message" },
      { status: 400 }
    );
  }

  const snapshot = await checkAristotleJobStatus({
    jobId: output.jobId,
    waitForCompletion: false,
  });

  const updatedSourceMessage = updateAristotleMessage({
    message: source.message,
    snapshot,
  });
  await updateMessage({
    id: updatedSourceMessage.id,
    chatId,
    message: updatedSourceMessage,
  });

  const allMessages = await getAllMessagesByChatId({ chatId });
  const existingContinuation = findExistingContinuationMessage({
    messages: allMessages,
    sourceMessageId: updatedSourceMessage.id,
  });
  if (existingContinuation) {
    return Response.json({
      continuationMessage: existingContinuation,
      sourceMessage: updatedSourceMessage,
      status: "continued",
    });
  }

  if (!(snapshot.completed || snapshot.failed)) {
    return Response.json({
      sourceMessage: updatedSourceMessage,
      status: "pending",
    });
  }

  const selectedModelId = DEFAULT_SCOUT_MODEL_ID as AppModelId;
  const continuationMessage = await generateContinuationMessage({
    chatId,
    chatOwnerUserId: chat.userId,
    sourceMessage: updatedSourceMessage,
    selectedModelId,
    snapshot,
    userId: session?.user?.id ?? null,
  });

  return Response.json({
    continuationMessage,
    sourceMessage: updatedSourceMessage,
    status: "continued",
  });
}
