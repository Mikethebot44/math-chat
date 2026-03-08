import type { AnthropicProviderOptions } from "@ai-sdk/anthropic";
import { devToolsMiddleware } from "@ai-sdk/devtools";
import type { GoogleGenerativeAIProviderOptions } from "@ai-sdk/google";
import type { OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import {
  extractReasoningMiddleware,
  type LanguageModelMiddleware,
  wrapLanguageModel,
} from "ai";
import { getActiveGateway } from "./active-gateway";
import type { AppModelId } from "./app-models";
import { getAppModelDefinition } from "./app-models";

export const getLanguageModel = async (modelId: AppModelId) => {
  const model = await getAppModelDefinition(modelId);
  const languageProvider = getActiveGateway().createLanguageModel(
    model.apiModelId
  );

  const middlewares: Parameters<typeof wrapLanguageModel>[0]["middleware"][] =
    [];

  if (process.env.NODE_ENV === "development") {
    middlewares.push(devToolsMiddleware());
  }

  if (model.reasoning && model.owned_by === "xai") {
    middlewares.push(extractReasoningMiddleware({ tagName: "think" }));
  }

  if (middlewares.length === 0) {
    return languageProvider;
  }

  return wrapLanguageModel({
    model: languageProvider as LanguageModelV3,
    middleware: middlewares as LanguageModelMiddleware[],
  });
};

export const getImageModel = (modelId: string) => {
  const imageModel = getActiveGateway().createImageModel(modelId);
  if (!imageModel) {
    throw new Error(
      `Gateway '${getActiveGateway().type}' does not support dedicated image models. Use a multimodal language model instead.`
    );
  }
  return imageModel;
};

export const getVideoModel = (modelId: string) => {
  const videoModel = getActiveGateway().createVideoModel(modelId);
  if (!videoModel) {
    throw new Error(
      `Gateway '${getActiveGateway().type}' does not support video models.`
    );
  }
  return videoModel;
};

export const getMultimodalImageModel = (modelId: string) =>
  getActiveGateway().createLanguageModel(modelId);

export const getModelProviderOptions = async (
  providerModelId: AppModelId
): Promise<
  | {
      openai: OpenAIResponsesProviderOptions;
    }
  | {
      anthropic: AnthropicProviderOptions;
    }
  | {
      xai: Record<string, never>;
    }
  | {
      google: GoogleGenerativeAIProviderOptions;
    }
  | Record<string, never>
> => {
  const model = await getAppModelDefinition(providerModelId);

  if (model.owned_by === "openai") {
    if (model.reasoning) {
      const modelName = model.apiModelId.split("/").pop() ?? model.apiModelId;
      const reasoningEffort =
        model.reasoningEffort ||
        (modelName === "gpt-5" ||
        modelName === "gpt-5-mini" ||
        modelName === "gpt-5-nano"
          ? "low"
          : undefined);

      return {
        openai: {
          reasoningSummary: "auto",
          ...(reasoningEffort ? { reasoningEffort } : {}),
        } satisfies OpenAIResponsesProviderOptions,
      };
    }

    return { openai: {} };
  }

  if (model.owned_by === "anthropic") {
    if (model.reasoning) {
      return {
        anthropic: {
          thinking: {
            type: "enabled",
            budgetTokens: 4096,
          },
        } satisfies AnthropicProviderOptions,
      };
    }

    return { anthropic: {} };
  }

  if (model.owned_by === "xai") {
    return {
      xai: {},
    };
  }

  if (model.owned_by === "google") {
    if (model.reasoning) {
      return {
        google: {
          thinkingConfig: {
            thinkingBudget: 10_000,
          },
        },
      };
    }

    return { google: {} };
  }

  return {};
};
