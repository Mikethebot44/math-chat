import {
  convertToModelMessages,
  createUIMessageStream,
  generateText,
  readUIMessageStream,
} from "ai";
import throttle from "throttleit";
import { filterPartsForLLM } from "@/app/(chat)/api/chat/filter-reasoning-parts";
import { getThreadUpToMessageId } from "@/app/(chat)/api/chat/get-thread-up-to-message-id";
import { createCoreChatAgent } from "@/lib/ai/core-chat-agent";
import { determineExplicitlyRequestedTools } from "@/lib/ai/determine-explicitly-requested-tools";
import {
  ALWAYS_ENABLED_MATH_AGENT_TOOLS,
  DEFAULT_CHAT_TOOL,
} from "@/lib/ai/math-agent";
import { getModelProviderOptions, getLanguageModel } from "@/lib/ai/providers";
import { systemPrompt } from "@/lib/ai/prompts";
import { DEFAULT_SCOUT_MODEL_ID } from "@/lib/ai/scout-models";
import {
  checkAristotleJobStatus,
  type AristotleJobStatusResult,
} from "@/lib/ai/tools/lean-proof/aristotle-client";
import type { AppModelDefinition, AppModelId } from "@/lib/ai/app-models";
import { getAppModelDefinition } from "@/lib/ai/app-models";
import { calculateMessagesTokens } from "@/lib/ai/token-utils";
import type { ChatMessage, ToolName } from "@/lib/ai/types";
import { config } from "@/lib/config";
import { replaceFilePartUrlByBinaryDataInMessages } from "@/lib/utils/download-assets";
import { CostAccumulator } from "@/lib/credits/cost-accumulator";
import { deductCredits } from "@/lib/db/credits";
import { getMcpConnectorsByUserId } from "@/lib/db/mcp-queries";
import {
  getAllMessagesByChatId,
  getChatById,
  getProjectById,
} from "@/lib/db/queries";
import { MAX_INPUT_TOKENS } from "@/lib/limits/tokens";
import { createModuleLogger } from "@/lib/logger";
import {
  appendAgentRunEvent,
  finalizeAgentRunFailure,
  finalizeAgentRunSuccess,
  getAgentRunById,
  getAssistantMessageForRun,
  setAgentRunStatus,
} from "@/lib/db/agent-runs";
import { diffMessageToRunEvents } from "./message-events";
import { buildRunStatusPart, type RunStatusPhase } from "./run-status";
import type { AgentRunErrorPayload } from "./types";

const log = createModuleLogger("agent-runs:execute");
const ARISTOTLE_POLL_INTERVAL_MS = 5000;
type PendingAristotleToolPart = Extract<
  ChatMessage["parts"][number],
  {
    type: "tool-leanProof" | "tool-aristotleCheckJob";
    state: "output-available";
  }
>;

function determineAllowedTools({
  modelDefinition,
  explicitlyRequestedTools,
}: {
  modelDefinition: AppModelDefinition;
  explicitlyRequestedTools: ToolName[] | null;
}): ToolName[] {
  if (!modelDefinition?.input) {
    return [];
  }

  if (explicitlyRequestedTools && explicitlyRequestedTools.length > 0) {
    return explicitlyRequestedTools.filter((tool) =>
      ALWAYS_ENABLED_MATH_AGENT_TOOLS.includes(tool)
    );
  }

  return ALWAYS_ENABLED_MATH_AGENT_TOOLS;
}

async function getSystemPromptForChat(chatId: string) {
  let system = systemPrompt();
  const chat = await getChatById({ id: chatId });
  if (chat?.projectId) {
    const project = await getProjectById({ id: chat.projectId });
    if (project?.instructions) {
      system = `${system}\n\nProject instructions:\n${project.instructions}`;
    }
  }
  return system;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPendingAristotleToolPart(
  part: ChatMessage["parts"][number]
): part is PendingAristotleToolPart {
  return Boolean(
    (part.type === "tool-leanProof" ||
      part.type === "tool-aristotleCheckJob") &&
      part.state === "output-available" &&
      isRecord(part.output) &&
      typeof part.output.jobId === "string" &&
      part.output.completed !== true &&
      part.output.failed !== true
  );
}

function getPendingAristotleToolPart(
  message: ChatMessage
): {
  index: number;
  part: PendingAristotleToolPart;
} | null {
  for (const [index, part] of message.parts.entries()) {
    if (isPendingAristotleToolPart(part)) {
      return { index, part };
    }
  }

  return null;
}

function updateAristotlePart({
  message,
  partIndex,
  snapshot,
}: {
  message: ChatMessage;
  partIndex: number;
  snapshot: AristotleJobStatusResult;
}) {
  return {
    ...message,
    parts: message.parts.map((part, index) =>
      index === partIndex && isPendingAristotleToolPart(part)
        ? {
            ...part,
            output: snapshot,
          }
        : part
    ) as ChatMessage["parts"],
  } satisfies ChatMessage;
}

function mergeUsage(
  left: ChatMessage["metadata"]["usage"],
  right: ChatMessage["metadata"]["usage"]
): ChatMessage["metadata"]["usage"] {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }

  const add = (a?: number, b?: number) =>
    a === undefined && b === undefined ? undefined : (a ?? 0) + (b ?? 0);

  return {
    inputTokenDetails: {
      cacheReadTokens: add(
        left.inputTokenDetails.cacheReadTokens,
        right.inputTokenDetails.cacheReadTokens
      ),
      cacheWriteTokens: add(
        left.inputTokenDetails.cacheWriteTokens,
        right.inputTokenDetails.cacheWriteTokens
      ),
      noCacheTokens: add(
        left.inputTokenDetails.noCacheTokens,
        right.inputTokenDetails.noCacheTokens
      ),
    },
    inputTokens: add(left.inputTokens, right.inputTokens),
    outputTokenDetails: {
      reasoningTokens: add(
        left.outputTokenDetails.reasoningTokens,
        right.outputTokenDetails.reasoningTokens
      ),
      textTokens: add(
        left.outputTokenDetails.textTokens,
        right.outputTokenDetails.textTokens
      ),
    },
    outputTokens: add(left.outputTokens, right.outputTokens),
    totalTokens: add(left.totalTokens, right.totalTokens),
    cachedInputTokens: add(left.cachedInputTokens, right.cachedInputTokens),
    reasoningTokens: add(left.reasoningTokens, right.reasoningTokens),
  };
}

async function emitMessageDiffs({
  next,
  previous,
  runId,
}: {
  next: ChatMessage;
  previous: ChatMessage | null;
  runId: string;
}) {
  const events = diffMessageToRunEvents({ next, previous });
  for (const event of events) {
    await appendAgentRunEvent({
      kind: event.kind,
      payload: event.payload,
      runId,
    });
  }
}

async function emitRunStatus({
  detail,
  label,
  phase,
  runId,
  startedAt,
}: {
  detail?: string;
  label: string;
  phase: RunStatusPhase;
  runId: string;
  startedAt: string;
}) {
  await appendAgentRunEvent({
    kind: "status-update",
    payload: {
      part: buildRunStatusPart({
        detail,
        label,
        phase,
        startedAt,
      }),
    },
    runId,
  });
}

async function generateAristotleContinuationText({
  chatId,
  currentAssistantMessage,
  snapshot,
  userMessageId,
}: {
  chatId: string;
  currentAssistantMessage: ChatMessage;
  snapshot: AristotleJobStatusResult;
  userMessageId: string;
}): Promise<{
  text: string;
  usage: ChatMessage["metadata"]["usage"];
}> {
  const allMessages = await getAllMessagesByChatId({ chatId });
  const updatedMessages = allMessages.map((message) =>
    message.id === currentAssistantMessage.id ? currentAssistantMessage : message
  );
  const thread = updatedMessages
    .filter((message) => message.id !== currentAssistantMessage.id)
    .slice(-4);

  const continuationPrompt = snapshot.failed
    ? [
        `The Aristotle job ${snapshot.jobId} has finished with an error.`,
        "Continue the conversation for the user.",
        "Explain briefly that Aristotle returned invalid Lean output.",
        "Summarize the failure in plain English and suggest a next step.",
        "Do not call any tools in this response.",
      ].join(" ")
    : [
        `The Aristotle job ${snapshot.jobId} has completed.`,
        "Continue the conversation for the user.",
        "Summarize the result and mention that the Lean code is available in the Aristotle tool output.",
        "Do not invent Lean code beyond what Aristotle returned.",
        "Do not call any tools in this response.",
      ].join(" ");

  const continuationRequest: ChatMessage = {
    id: userMessageId,
    metadata: {
      activeRunId: null,
      activeStreamId: null,
      createdAt: new Date(),
      parentMessageId: currentAssistantMessage.id,
      selectedModel: DEFAULT_SCOUT_MODEL_ID as AppModelId,
      selectedTool: undefined,
    },
    parts: [{ type: "text", text: continuationPrompt }],
    role: "user",
  };

  const filteredMessages = filterPartsForLLM(
    [...thread, currentAssistantMessage, continuationRequest].slice(-5)
  );
  const modelMessages = await convertToModelMessages(filteredMessages, {
    convertDataPart: (): undefined => undefined,
  });
  const contextForLLM =
    await replaceFilePartUrlByBinaryDataInMessages(modelMessages);

  const [model, providerOptions, system] = await Promise.all([
    getLanguageModel(DEFAULT_SCOUT_MODEL_ID),
    getModelProviderOptions(DEFAULT_SCOUT_MODEL_ID),
    getSystemPromptForChat(chatId),
  ]);

  const result = await generateText({
    model,
    system,
    messages: contextForLLM,
    providerOptions,
    experimental_telemetry: {
      functionId: "background-aristotle-continuation",
      isEnabled: true,
    },
  });

  return {
    text: result.text,
    usage: result.usage,
  };
}

async function maybeFinalizeAristotle({
  abortController,
  assistantMessage,
  chatId,
  costAccumulator,
  runId,
  runStartedAt,
}: {
  abortController: AbortController;
  assistantMessage: ChatMessage;
  chatId: string;
  costAccumulator: CostAccumulator;
  runId: string;
  runStartedAt: string;
}) {
  const pending = getPendingAristotleToolPart(assistantMessage);
  if (!pending) {
    return assistantMessage;
  }

  await emitRunStatus({
    label: "Waiting for Aristotle...",
    phase: "waiting-aristotle",
    runId,
    startedAt: runStartedAt,
  });

  const output = pending.part.output as { jobId: string };
  let updatedMessage = assistantMessage;

  while (!abortController.signal.aborted) {
    const latestRun = await getAgentRunById({ id: runId });
    if (latestRun?.cancelRequestedAt) {
      abortController.abort();
      break;
    }

    const snapshot = await checkAristotleJobStatus({
      jobId: output.jobId,
      pollIntervalMs: ARISTOTLE_POLL_INTERVAL_MS,
      waitForCompletion: false,
    });

    const nextMessage = updateAristotlePart({
      message: updatedMessage,
      partIndex: pending.index,
      snapshot,
    });
    await emitMessageDiffs({
      next: nextMessage,
      previous: updatedMessage,
      runId,
    });
    updatedMessage = nextMessage;

    if (snapshot.completed || snapshot.failed) {
      await emitRunStatus({
        label: "Preparing response...",
        phase: "finalizing",
        runId,
        startedAt: runStartedAt,
      });

      const continuation = await generateAristotleContinuationText({
        chatId,
        currentAssistantMessage: updatedMessage,
        snapshot,
        userMessageId: `${updatedMessage.id}-aristotle-continuation`,
      });

      if (continuation.usage) {
        costAccumulator.addLLMCost(
          DEFAULT_SCOUT_MODEL_ID as AppModelId,
          continuation.usage,
          "background-aristotle-continuation"
        );
      }

      const nextParts = [
        ...updatedMessage.parts,
        {
          type: "text" as const,
          text: continuation.text,
          state: "done" as const,
        },
      ] as ChatMessage["parts"];
      const finalMessage: ChatMessage = {
        ...updatedMessage,
        metadata: {
          ...updatedMessage.metadata,
          usage: mergeUsage(updatedMessage.metadata.usage, continuation.usage),
        },
        parts: nextParts,
      };

      await emitMessageDiffs({
        next: finalMessage,
        previous: updatedMessage,
        runId,
      });
      return finalMessage;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, ARISTOTLE_POLL_INTERVAL_MS)
    );
  }

  throw new Error("Run aborted while waiting for Aristotle");
}

export async function executeAgentRun({ runId }: { runId: string }) {
  const run = await getAgentRunById({ id: runId });
  if (!run) {
    throw new Error(`Agent run ${runId} not found`);
  }

  const assistantMessage = await getAssistantMessageForRun({ runId });
  if (!assistantMessage) {
    throw new Error(`Assistant message for run ${runId} not found`);
  }

  const userMessageResult = await getAllMessagesByChatId({ chatId: run.chatId });
  const userMessage = userMessageResult.find((message) => message.id === run.userMessageId);
  if (!userMessage) {
    throw new Error(`User message ${run.userMessageId} not found`);
  }

  const selectedModelId = run.selectedModel as AppModelId;
  const selectedTool = DEFAULT_CHAT_TOOL;
  const explicitlyRequestedTools =
    determineExplicitlyRequestedTools(selectedTool);
  const modelDefinition = await getAppModelDefinition(selectedModelId);
  const allowedTools = determineAllowedTools({
    explicitlyRequestedTools,
    modelDefinition,
  });

  const totalTokens = calculateMessagesTokens(
    await convertToModelMessages([userMessage])
  );
  if (totalTokens > MAX_INPUT_TOKENS) {
    throw new Error(
      `Message too long: ${totalTokens} tokens (max: ${MAX_INPUT_TOKENS})`
    );
  }

  const previousMessages = (
    await getThreadUpToMessageId(run.chatId, userMessage.metadata.parentMessageId)
  ).slice(-5);

  const mcpConnectors =
    config.ai.tools.mcp.enabled && userMessage.role === "user"
      ? await getMcpConnectorsByUserId({ userId: run.userId })
      : [];

  const system = await getSystemPromptForChat(run.chatId);
  const abortController = new AbortController();
  const costAccumulator = new CostAccumulator();
  let lastMessage: ChatMessage | null = null;
  const runStartedAt = new Date().toISOString();

  await setAgentRunStatus({
    id: runId,
    status: "running",
  });
  await appendAgentRunEvent({
    kind: "run-started",
    payload: {
      sandboxId: run.sandboxId,
      startedAt: runStartedAt,
    },
    runId,
  });
  await emitRunStatus({
    label: "Thinking...",
    phase: "thinking",
    runId,
    startedAt: runStartedAt,
  });

  const onChunk = throttle(async () => {
    const latestRun = await getAgentRunById({ id: runId });
    if (latestRun?.cancelRequestedAt) {
      abortController.abort();
    }
  }, 1000);

  try {
    const stream = createUIMessageStream<ChatMessage>({
      execute: async ({ writer }) => {
        const { result } = await createCoreChatAgent({
          abortSignal: abortController.signal,
          budgetAllowedTools: allowedTools,
          costAccumulator,
          dataStream: writer,
          explicitlyRequestedTools,
          mcpConnectors,
          messageId: assistantMessage.id,
          onChunk,
          previousMessages,
          selectedModelId,
          system,
          userId: run.userId,
          userMessage,
        });

        writer.merge(
          result.toUIMessageStream({
            messageMetadata: ({ part }) => {
              if (part.type === "start") {
                return {
                  ...assistantMessage.metadata,
                  activeRunId: runId,
                  activeStreamId: null,
                  selectedModel: selectedModelId,
                };
              }

              if (part.type === "finish") {
                if (part.totalUsage) {
                  costAccumulator.addLLMCost(
                    selectedModelId,
                    part.totalUsage,
                    "background-main-chat"
                  );
                }
                return {
                  ...assistantMessage.metadata,
                  activeRunId: runId,
                  activeStreamId: null,
                  selectedModel: selectedModelId,
                  usage: part.totalUsage,
                };
              }
            },
            sendReasoning: true,
          })
        );

        await result.consumeStream();
      },
      generateId: () => assistantMessage.id,
      onError: (error) => {
        log.error({ error, runId }, "background agent run stream failed");
        return "Background agent run failed.";
      },
    });

    for await (const snapshot of readUIMessageStream<ChatMessage>({ stream })) {
      const nextMessage = snapshot as ChatMessage;
      await emitMessageDiffs({
        next: nextMessage,
        previous: lastMessage,
        runId,
      });
      lastMessage = nextMessage;
    }

    if (!lastMessage) {
      throw new Error("No assistant output was generated");
    }

    const completedMessage = await maybeFinalizeAristotle({
      abortController,
      assistantMessage: lastMessage,
      chatId: run.chatId,
      costAccumulator,
      runId,
      runStartedAt,
    });

    await finalizeAgentRunSuccess({
      assistantMessage: {
        ...completedMessage,
        metadata: {
          ...completedMessage.metadata,
          activeRunId: null,
          activeStreamId: null,
        },
      },
      chatId: run.chatId,
      runId,
    });

    await deductCredits(run.userId, await costAccumulator.getTotalCost());

    return completedMessage;
  } catch (error) {
    const latestRun = await getAgentRunById({ id: runId });
    const cancelled = abortController.signal.aborted || Boolean(latestRun?.cancelRequestedAt);
    const payload: AgentRunErrorPayload = {
      message: error instanceof Error ? error.message : "Unknown background run error",
      retryable: false,
    };

    await finalizeAgentRunFailure({
      assistantMessageId: run.assistantMessageId,
      error: payload,
      runId,
      status: cancelled ? "cancelled" : "failed",
    });
    throw error;
  }
}
