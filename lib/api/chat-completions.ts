import { convertToModelMessages, generateText } from "ai";
import { z } from "zod";
import { getAppModelDefinition } from "@/lib/ai/app-models";
import { createCoreChatAgent } from "@/lib/ai/core-chat-agent";
import { truncateModelMessagesToFitBudget } from "@/lib/ai/history-truncation";
import { systemPrompt } from "@/lib/ai/prompts";
import { getLanguageModel, getModelProviderOptions } from "@/lib/ai/providers";
import { DEFAULT_SCOUT_MODEL_ID } from "@/lib/ai/scout-models";
import {
  type AristotleJobStatusResult,
  checkAristotleJobStatus,
} from "@/lib/ai/tools/lean-proof/aristotle-client";
import { stripProviderLeanHeader } from "@/lib/ai/tools/lean-proof/normalize-lean-source";
import type { ChatMessage, StreamWriter } from "@/lib/ai/types";
import { CostAccumulator } from "@/lib/credits/cost-accumulator";
import {
  beginApiCompletionFinalization,
  completeApiCompletionAfterFinalization,
  createApiCompletion,
  failApiCompletionAfterFinalization,
  finalizeApiCompletionStart,
  getApiCompletionByIdForUser,
} from "@/lib/db/api-access";
import { canSpend, deductCredits, getCredits } from "@/lib/db/credits";
import type { ApiCompletion } from "@/lib/db/schema";
import { createModuleLogger } from "@/lib/logger";
import { generateUUID } from "@/lib/utils";

const log = createModuleLogger("api:chat-completions");

const API_MODEL_NAME = "Scout";
const API_ACTIVE_TOOLS = ["leanProof", "aristotleCheckJob"] as const;

export const apiCompletionMessageSchema = z.object({
  role: z.enum(["assistant", "system", "user"]),
  content: z.string().min(1),
});

export const createApiCompletionRequestSchema = z
  .object({
    messages: z.array(apiCompletionMessageSchema).min(1),
    model: z.string().optional(),
    stream: z.boolean().optional(),
    temperature: z.number().optional(),
    max_tokens: z.number().int().optional(),
  })
  .superRefine((value, ctx) => {
    const nonSystemMessages = value.messages.filter(
      (message) => message.role !== "system"
    );
    const lastMessage = nonSystemMessages.at(-1);

    if (!lastMessage || lastMessage.role !== "user") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "The last non-system message must be from the user.",
        path: ["messages"],
      });
    }
  })
  .passthrough();

type ApiCompletionMessage = z.infer<typeof apiCompletionMessageSchema>;

interface LeanToolSnapshot {
  completed?: boolean;
  failed?: boolean;
  jobId: string;
  leanCode?: string;
  message?: string;
  rawResponse?: unknown;
}

function createNoOpStreamWriter(): StreamWriter {
  return {
    write: () => {
      // No-op: API completions do not stream UI data parts.
    },
    merge: () => {
      // No-op: API completions do not stream UI data parts.
    },
  } as unknown as StreamWriter;
}

function mapDbStatusToApiStatus(status: ApiCompletion["status"]) {
  if (status === "completed") {
    return "COMPLETED" as const;
  }

  if (status === "failed") {
    return "FAILED" as const;
  }

  if (status === "queued") {
    return "QUEUED" as const;
  }

  return "IN_PROGRESS" as const;
}

function toUsageShape(completion: ApiCompletion) {
  if (
    completion.usagePromptTokens === null ||
    completion.usageCompletionTokens === null
  ) {
    return null;
  }

  return {
    prompt_tokens: completion.usagePromptTokens,
    completion_tokens: completion.usageCompletionTokens,
    total_tokens:
      completion.usagePromptTokens + completion.usageCompletionTokens,
  };
}

function toChoices({
  status,
  responseText,
}: {
  responseText: string | null;
  status: ReturnType<typeof mapDbStatusToApiStatus>;
}) {
  if (!responseText || (status !== "COMPLETED" && status !== "FAILED")) {
    return [];
  }

  return [
    {
      index: 0,
      message: {
        role: "assistant" as const,
        content: responseText,
      },
      finish_reason:
        status === "FAILED" ? ("error" as const) : ("stop" as const),
    },
  ];
}

function getApiError(completion: ApiCompletion) {
  if (!(completion.errorCode && completion.errorMessage)) {
    return null;
  }

  return {
    code: completion.errorCode,
    message: completion.errorMessage,
  };
}

async function toApiCompletionResponse(completion: ApiCompletion) {
  const status = mapDbStatusToApiStatus(completion.status);
  const creditsRemaining = await getCredits(completion.userId);

  return {
    id: completion.id,
    object: "chat.completion" as const,
    created: Math.floor(completion.createdAt.getTime() / 1000),
    model: API_MODEL_NAME,
    status,
    choices: toChoices({
      status,
      responseText: completion.responseText,
    }),
    lean_file:
      completion.leanFileName && completion.leanFileContent
        ? {
            filename: completion.leanFileName,
            content: completion.leanFileContent,
          }
        : null,
    usage: toUsageShape(completion),
    error: getApiError(completion),
    credits_remaining: creditsRemaining,
  };
}

function buildApiSystemPrompt(messages: ApiCompletionMessage[]) {
  const systemMessages = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content.trim())
    .filter(Boolean);

  return [systemPrompt(), ...systemMessages].join("\n\n");
}

function buildChatMessages(messages: ApiCompletionMessage[]) {
  const nonSystemMessages = messages.filter(
    (message) => message.role !== "system"
  );
  const lastUserIndex = [...nonSystemMessages]
    .reverse()
    .findIndex((message) => message.role === "user");

  if (lastUserIndex === -1) {
    throw new Error("The last non-system message must be from the user.");
  }

  const resolvedLastUserIndex = nonSystemMessages.length - 1 - lastUserIndex;

  if (resolvedLastUserIndex !== nonSystemMessages.length - 1) {
    throw new Error("The last non-system message must be from the user.");
  }

  const chatMessages: ChatMessage[] = [];

  for (const message of nonSystemMessages) {
    const id = generateUUID();
    const previousMessage = chatMessages.at(-1);
    chatMessages.push({
      id,
      role: message.role,
      parts: [{ type: "text", text: message.content }],
      metadata: {
        createdAt: new Date(),
        parentMessageId: previousMessage?.id ?? null,
        selectedModel: DEFAULT_SCOUT_MODEL_ID,
        activeStreamId: null,
      },
    });
  }

  return {
    previousMessages: chatMessages.slice(0, -1),
    userMessage: chatMessages.at(-1) as ChatMessage,
  };
}

function processToolCall(
  content: { toolCallId?: string; toolName: string; input: unknown },
  parts: ChatMessage["parts"]
) {
  parts.push({
    type: `tool-${content.toolName}` as ChatMessage["parts"][number]["type"],
    toolCallId: content.toolCallId || generateUUID(),
    state: "input-available",
    input: content.input,
  } as ChatMessage["parts"][number]);
}

function processToolResult(
  content: { toolCallId?: string; toolName: string; output: unknown },
  parts: ChatMessage["parts"]
) {
  const existingIndex = parts.findIndex(
    (part) =>
      part.type.startsWith("tool-") &&
      "toolCallId" in part &&
      part.toolCallId === content.toolCallId
  );

  if (existingIndex >= 0) {
    const part = parts[existingIndex];
    if (part.type.startsWith("tool-") && "state" in part) {
      parts[existingIndex] = {
        ...part,
        state: "output-available",
        output: content.output,
      } as ChatMessage["parts"][number];
      return;
    }
  }

  parts.push({
    type: `tool-${content.toolName}` as ChatMessage["parts"][number]["type"],
    toolCallId: content.toolCallId || generateUUID(),
    state: "output-available",
    output: content.output,
  } as ChatMessage["parts"][number]);
}

function extractAssistantParts(
  steps: Awaited<
    Awaited<ReturnType<typeof createCoreChatAgent>>["result"]["steps"]
  >
) {
  const parts: ChatMessage["parts"] = [];

  for (const step of steps ?? []) {
    for (const content of step.content) {
      if (content.type === "tool-call") {
        processToolCall(content, parts);
      }

      if (content.type === "tool-result") {
        processToolResult(content, parts);
      }
    }
  }

  return parts;
}

function getLeanCode(snapshot: LeanToolSnapshot) {
  if (typeof snapshot.leanCode === "string" && snapshot.leanCode.trim()) {
    return stripProviderLeanHeader(snapshot.leanCode);
  }

  if (
    typeof snapshot.rawResponse !== "object" ||
    snapshot.rawResponse === null ||
    !("lean_code" in snapshot.rawResponse)
  ) {
    return null;
  }

  const leanCode = snapshot.rawResponse.lean_code;
  return typeof leanCode === "string" && leanCode.trim()
    ? stripProviderLeanHeader(leanCode)
    : null;
}

function getLatestLeanToolSnapshot(parts: ChatMessage["parts"]) {
  const leanParts = parts.filter(
    (
      part
    ): part is Extract<
      ChatMessage["parts"][number],
      {
        type: "tool-leanProof" | "tool-aristotleCheckJob";
        state: "output-available";
      }
    > =>
      (part.type === "tool-leanProof" ||
        part.type === "tool-aristotleCheckJob") &&
      part.state === "output-available" &&
      typeof part.output === "object" &&
      part.output !== null &&
      "jobId" in part.output &&
      typeof part.output.jobId === "string"
  );

  const latestPart = leanParts.at(-1);
  if (!(latestPart && "output" in latestPart && latestPart.output)) {
    return null;
  }

  return latestPart.output as LeanToolSnapshot;
}

async function convertApiMessagesToModelMessages({
  messages,
  system,
}: {
  messages: ChatMessage[];
  system: string;
}) {
  const modelMessages = await convertToModelMessages(messages, {
    convertDataPart: (_part): undefined => undefined,
  });
  const modelDefinition = await getAppModelDefinition(DEFAULT_SCOUT_MODEL_ID);

  return truncateModelMessagesToFitBudget(modelMessages, modelDefinition, {
    system,
  });
}

async function executeInitialCompletion({
  messages,
  userId,
}: {
  messages: ApiCompletionMessage[];
  userId: string;
}) {
  const { previousMessages, userMessage } = buildChatMessages(messages);
  const costAccumulator = new CostAccumulator();

  const { result } = await createCoreChatAgent({
    system: buildApiSystemPrompt(messages),
    userMessage,
    previousMessages,
    selectedModelId: DEFAULT_SCOUT_MODEL_ID,
    explicitlyRequestedTools: null,
    userId,
    budgetAllowedTools: [...API_ACTIVE_TOOLS],
    messageId: userMessage.id,
    dataStream: createNoOpStreamWriter(),
    onError: (error) => {
      throw error;
    },
    costAccumulator,
    useTokenAwareHistoryTruncation: true,
  });

  await result.consumeStream();

  const [output, usage, steps] = await Promise.all([
    result.output,
    result.usage,
    result.steps,
  ]);

  if (usage) {
    costAccumulator.addLLMCost(DEFAULT_SCOUT_MODEL_ID, usage, "api-start");
  }

  const parts = extractAssistantParts(steps);
  if (output) {
    parts.unshift({ type: "text", text: output });
  }

  return {
    assistantText: output || "",
    assistantMessage: {
      id: generateUUID(),
      role: "assistant" as const,
      parts,
      metadata: {
        createdAt: new Date(),
        parentMessageId: userMessage.id,
        selectedModel: DEFAULT_SCOUT_MODEL_ID,
        activeStreamId: null,
        usage: usage ?? undefined,
      },
    } satisfies ChatMessage,
    costAccumulator,
    usage,
  };
}

async function generateContinuationText({
  messages,
  snapshot,
}: {
  messages: ApiCompletionMessage[];
  snapshot: AristotleJobStatusResult;
}) {
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

  const { previousMessages, userMessage } = buildChatMessages(messages);
  const apiSystemPrompt = buildApiSystemPrompt(messages);
  const continuationRequest: ChatMessage = {
    id: generateUUID(),
    role: "user",
    parts: [{ type: "text", text: continuationPrompt }],
    metadata: {
      createdAt: new Date(),
      parentMessageId: userMessage.id,
      selectedModel: DEFAULT_SCOUT_MODEL_ID,
      activeStreamId: null,
    },
  };

  const modelMessages = await convertApiMessagesToModelMessages({
    messages: [...previousMessages, userMessage, continuationRequest],
    system: apiSystemPrompt,
  });
  const [model, providerOptions] = await Promise.all([
    getLanguageModel(DEFAULT_SCOUT_MODEL_ID),
    getModelProviderOptions(DEFAULT_SCOUT_MODEL_ID),
  ]);

  const result = await generateText({
    model,
    system: apiSystemPrompt,
    messages: modelMessages,
    providerOptions,
    experimental_telemetry: {
      isEnabled: true,
      functionId: "api-aristotle-continuation",
    },
  });

  return {
    text: result.text,
    usage: result.usage,
  };
}

async function chargeCredits({
  userId,
  costAccumulator,
}: {
  costAccumulator: CostAccumulator;
  userId: string;
}) {
  const totalCost = await costAccumulator.getTotalCost();
  if (totalCost > 0) {
    await deductCredits(userId, totalCost);
  }
  return totalCost;
}

export async function createProgrammaticCompletion({
  messages,
  userId,
}: {
  messages: ApiCompletionMessage[];
  userId: string;
}) {
  const hasCredits = await canSpend(userId);
  if (!hasCredits) {
    return {
      type: "insufficient_credits" as const,
    };
  }

  const completionId = generateUUID();
  await createApiCompletion({
    id: completionId,
    userId,
    model: API_MODEL_NAME,
    requestMessages: messages,
  });

  let creditsCharged = 0;
  let usagePromptTokens = 0;
  let usageCompletionTokens = 0;

  try {
    const initialResult = await executeInitialCompletion({ messages, userId });
    usagePromptTokens += initialResult.usage?.inputTokens ?? 0;
    usageCompletionTokens += initialResult.usage?.outputTokens ?? 0;

    const initialCost = await chargeCredits({
      userId,
      costAccumulator: initialResult.costAccumulator,
    });
    creditsCharged += initialCost;
    const initialSnapshot = getLatestLeanToolSnapshot(
      initialResult.assistantMessage.parts
    );

    if (!initialSnapshot?.jobId) {
      const completion = await finalizeApiCompletionStart({
        id: completionId,
        userId,
        status: "completed",
        responseText: initialResult.assistantText,
        usagePromptTokens,
        usageCompletionTokens,
        creditsCharged,
      });

      return {
        type: "ok" as const,
        completion: await toApiCompletionResponse(completion),
      };
    }

    if (!(initialSnapshot.completed || initialSnapshot.failed)) {
      const completion = await finalizeApiCompletionStart({
        id: completionId,
        userId,
        status: "in_progress",
        aristotleJobId: initialSnapshot.jobId,
        usagePromptTokens,
        usageCompletionTokens,
        creditsCharged,
      });

      return {
        type: "ok" as const,
        completion: await toApiCompletionResponse(completion),
      };
    }

    const continuationCostAccumulator = new CostAccumulator();
    const continuation = await generateContinuationText({
      messages,
      snapshot: initialSnapshot as AristotleJobStatusResult,
    });
    if (continuation.usage) {
      continuationCostAccumulator.addLLMCost(
        DEFAULT_SCOUT_MODEL_ID,
        continuation.usage,
        "api-aristotle-continuation"
      );
    }
    const continuationCost = await chargeCredits({
      userId,
      costAccumulator: continuationCostAccumulator,
    });
    creditsCharged += continuationCost;
    usagePromptTokens += continuation.usage?.inputTokens ?? 0;
    usageCompletionTokens += continuation.usage?.outputTokens ?? 0;

    const leanFileContent = getLeanCode(initialSnapshot);
    const completion = await finalizeApiCompletionStart({
      id: completionId,
      userId,
      status: initialSnapshot.failed ? "failed" : "completed",
      responseText: continuation.text,
      leanFileName: leanFileContent ? `${initialSnapshot.jobId}.lean` : null,
      leanFileContent,
      errorCode: initialSnapshot.failed ? "aristotle_failed" : null,
      errorMessage:
        initialSnapshot.failed && initialSnapshot.message
          ? initialSnapshot.message
          : null,
      usagePromptTokens,
      usageCompletionTokens,
      creditsCharged,
    });

    return {
      type: "ok" as const,
      completion: await toApiCompletionResponse(completion),
    };
  } catch (error) {
    log.error({ error }, "Failed to create programmatic completion");
    const completion = await finalizeApiCompletionStart({
      id: completionId,
      userId,
      status: "failed",
      errorCode: "completion_failed",
      errorMessage:
        error instanceof Error ? error.message : "Failed to create completion",
      responseText: "Failed to create completion.",
      usagePromptTokens,
      usageCompletionTokens,
      creditsCharged,
    });

    return {
      type: "ok" as const,
      completion: await toApiCompletionResponse(completion),
    };
  }
}

export async function getProgrammaticCompletion({
  completionId,
  userId,
}: {
  completionId: string;
  userId: string;
}) {
  const completion = await getApiCompletionByIdForUser({
    id: completionId,
    userId,
  });

  if (!completion) {
    return null;
  }

  if (
    completion.status === "queued" ||
    completion.status === "in_progress" ||
    completion.status === "finalizing"
  ) {
    return await toApiCompletionResponse(completion);
  }

  return await toApiCompletionResponse(completion);
}

function shouldReturnPolledCompletion(completion: ApiCompletion) {
  return (
    completion.status === "completed" ||
    completion.status === "failed" ||
    completion.status === "finalizing" ||
    completion.status === "queued" ||
    !completion.aristotleJobId
  );
}

async function finalizePolledProgrammaticCompletion({
  completion,
  completionId,
  snapshot,
  userId,
}: {
  completion: ApiCompletion;
  completionId: string;
  snapshot: AristotleJobStatusResult;
  userId: string;
}) {
  const requestMessages = completion.requestMessages as ApiCompletionMessage[];
  let creditsCharged = 0;
  let usagePromptTokens = 0;
  let usageCompletionTokens = 0;

  try {
    const continuation = await generateContinuationText({
      messages: requestMessages,
      snapshot,
    });
    usagePromptTokens += continuation.usage?.inputTokens ?? 0;
    usageCompletionTokens += continuation.usage?.outputTokens ?? 0;

    const costAccumulator = new CostAccumulator();
    if (continuation.usage) {
      costAccumulator.addLLMCost(
        DEFAULT_SCOUT_MODEL_ID,
        continuation.usage,
        "api-aristotle-continuation"
      );
    }
    const continuationCost = await chargeCredits({
      userId,
      costAccumulator,
    });
    creditsCharged += continuationCost;
    const leanFileContent = getLeanCode(snapshot);

    const finalCompletion = snapshot.failed
      ? await failApiCompletionAfterFinalization({
          id: completionId,
          userId,
          responseText: continuation.text,
          errorCode: "aristotle_failed",
          errorMessage: snapshot.message,
          usagePromptTokens,
          usageCompletionTokens,
          creditsCharged,
        })
      : await completeApiCompletionAfterFinalization({
          id: completionId,
          userId,
          responseText: continuation.text,
          leanFileName: leanFileContent ? `${snapshot.jobId}.lean` : null,
          leanFileContent,
          usagePromptTokens,
          usageCompletionTokens,
          creditsCharged,
        });

    if (!finalCompletion) {
      const latestCompletion = await getApiCompletionByIdForUser({
        id: completionId,
        userId,
      });
      return latestCompletion
        ? await toApiCompletionResponse(latestCompletion)
        : null;
    }

    return await toApiCompletionResponse(finalCompletion);
  } catch (error) {
    log.error({ error, completionId }, "Failed to finalize API completion");
    const finalCompletion = await failApiCompletionAfterFinalization({
      id: completionId,
      userId,
      responseText: "Failed to finalize completion.",
      errorCode: "finalization_failed",
      errorMessage:
        error instanceof Error
          ? error.message
          : "Failed to finalize completion",
      usagePromptTokens,
      usageCompletionTokens,
      creditsCharged,
    });

    return finalCompletion
      ? await toApiCompletionResponse(finalCompletion)
      : null;
  }
}

export async function pollProgrammaticCompletion({
  completionId,
  userId,
}: {
  completionId: string;
  userId: string;
}) {
  const completion = await getApiCompletionByIdForUser({
    id: completionId,
    userId,
  });

  if (!completion) {
    return null;
  }

  if (shouldReturnPolledCompletion(completion)) {
    return await toApiCompletionResponse(completion);
  }

  const jobId = completion.aristotleJobId;
  if (!jobId) {
    return await toApiCompletionResponse(completion);
  }

  const snapshot = await checkAristotleJobStatus({
    jobId,
    waitForCompletion: false,
  });

  if (!(snapshot.completed || snapshot.failed)) {
    return await toApiCompletionResponse(completion);
  }

  const claim = await beginApiCompletionFinalization({
    id: completionId,
    userId,
  });

  if (!claim) {
    const latestCompletion = await getApiCompletionByIdForUser({
      id: completionId,
      userId,
    });
    return latestCompletion
      ? await toApiCompletionResponse(latestCompletion)
      : null;
  }

  return await finalizePolledProgrammaticCompletion({
    completion,
    completionId,
    snapshot,
    userId,
  });
}
