import type { AppModelId, ModelId } from "./app-model-id";
import type { ModelData } from "./model-data";

export type ScoutReasoningEffort = "medium" | "xhigh";

type ScoutModelCapabilities = Pick<
  ModelData,
  | "context_window"
  | "description"
  | "input"
  | "max_tokens"
  | "object"
  | "output"
  | "owned_by"
  | "pricing"
  | "tags"
  | "toolCall"
  | "type"
>;

export interface ScoutModelSpec {
  apiModelId: ModelId;
  description: string;
  fallback: ScoutModelCapabilities;
  id: AppModelId;
  name: string;
  reasoning: boolean;
  reasoningEffort?: ScoutReasoningEffort;
}

export const SCOUT_MODELS = [
  {
    id: "openai/gpt-5.2-reasoning" as AppModelId,
    apiModelId: "openai/gpt-5.2" as ModelId,
    name: "Scout",
    description: "Balanced reasoning agent for everyday work.",
    reasoning: true,
    reasoningEffort: "medium",
    fallback: {
      object: "model",
      owned_by: "openai",
      type: "language",
      context_window: 400_000,
      max_tokens: 128_000,
      toolCall: true,
      input: {
        text: true,
        image: true,
        pdf: true,
        video: false,
        audio: false,
      },
      output: {
        text: true,
        image: false,
        audio: false,
        video: false,
      },
      pricing: {
        input: "0.00000175",
        output: "0.000014",
        input_cache_read: "0.000000175",
      },
      tags: ["tool-use", "vision", "file-input", "reasoning"],
      description: "Balanced reasoning agent for everyday work.",
    },
  },
  {
    id: "openai/gpt-5.4-reasoning" as AppModelId,
    apiModelId: "openai/gpt-5.4" as ModelId,
    name: "Scout Pro",
    description: "High-performance reasoning agent for complex tasks.",
    reasoning: true,
    reasoningEffort: "xhigh",
    fallback: {
      object: "model",
      owned_by: "openai",
      type: "language",
      context_window: 1_050_000,
      max_tokens: 128_000,
      toolCall: true,
      input: {
        text: true,
        image: true,
        pdf: true,
        video: false,
        audio: false,
      },
      output: {
        text: true,
        image: false,
        audio: false,
        video: false,
      },
      pricing: {
        input: "0.0000025",
        output: "0.000015",
        input_cache_read: "0.00000025",
      },
      tags: ["tool-use", "vision", "file-input", "reasoning"],
      description: "High-performance reasoning agent for complex tasks.",
    },
  },
  {
    id: "openai/gpt-5.3-chat-latest" as AppModelId,
    apiModelId: "openai/gpt-5.3-chat-latest" as ModelId,
    name: "Scout Instant",
    description: "Fast, lightweight agent for quick chat.",
    reasoning: false,
    fallback: {
      object: "model",
      owned_by: "openai",
      type: "language",
      context_window: 128_000,
      max_tokens: 16_384,
      toolCall: true,
      input: {
        text: true,
        image: true,
        pdf: false,
        video: false,
        audio: false,
      },
      output: {
        text: true,
        image: false,
        audio: false,
        video: false,
      },
      pricing: {
        input: "0.00000175",
        output: "0.000014",
        input_cache_read: "0.000000175",
      },
      tags: ["tool-use", "vision"],
      description: "Fast, lightweight agent for quick chat.",
    },
  },
] as const satisfies readonly ScoutModelSpec[];

export const SCOUT_MODEL_IDS = {
  SCOUT: SCOUT_MODELS[0].id,
  SCOUT_PRO: SCOUT_MODELS[1].id,
  SCOUT_INSTANT: SCOUT_MODELS[2].id,
} as const;

export const DEFAULT_SCOUT_MODEL_ID = SCOUT_MODEL_IDS.SCOUT_PRO;

export const SCOUT_MODEL_ID_SET = new Set<AppModelId>(
  SCOUT_MODELS.map((model) => model.id)
);

export function isScoutModelId(modelId: string): modelId is AppModelId {
  return SCOUT_MODEL_ID_SET.has(modelId as AppModelId);
}
