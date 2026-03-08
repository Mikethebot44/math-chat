import { unstable_cache } from "next/cache";
import { config } from "@/lib/config";
import type { AppModelId, ModelId } from "./app-model-id";
import type { ModelData } from "./model-data";
import { fetchModels } from "./models";
import {
  generatedForGateway,
  models as generatedModels,
} from "./models.generated";
import { SCOUT_MODELS, type ScoutReasoningEffort } from "./scout-models";

export type { AppModelId, ModelId } from "./app-model-id";

export type AppModelDefinition = Omit<ModelData, "id"> & {
  id: AppModelId;
  apiModelId: ModelId;
  reasoningEffort?: ScoutReasoningEffort;
};

const DISABLED_MODELS = new Set(config.ai.disabledModels);
const fetchAllAppModelsCached = unstable_cache(
  async () => {
    const models = await fetchModels();
    return buildAppModels(models);
  },
  ["app-models", config.ai.gateway],
  {
    revalidate: 3600,
  }
);

function buildAppModels(models: ModelData[]): AppModelDefinition[] {
  return models
    .flatMap((model) => {
      const modelId = model.id as ModelId;
      // If the model supports reasoning, return two variants:
      // - Non-reasoning (original id, reasoning=false)
      // - Reasoning (id with -reasoning suffix, reasoning=true)
      if (model.reasoning === true) {
        const reasoningId = `${modelId}-reasoning` as AppModelId;

        return [
          {
            ...model,
            id: reasoningId,
            apiModelId: modelId,
            disabled: DISABLED_MODELS.has(modelId),
          },
          {
            ...model,
            reasoning: false,
            apiModelId: modelId,
            disabled: DISABLED_MODELS.has(modelId),
          },
        ];
      }

      // Models without reasoning stay as-is
      return [
        {
          ...model,
          apiModelId: modelId,
          disabled: DISABLED_MODELS.has(modelId),
        },
      ];
    })
    .filter(
      (model) => model.type === "language" && !model.disabled
    ) as AppModelDefinition[];
}

function buildScoutChatModels(
  appModels: AppModelDefinition[]
): AppModelDefinition[] {
  return SCOUT_MODELS.map((scoutModel) => {
    const reasoningEffort =
      "reasoningEffort" in scoutModel ? scoutModel.reasoningEffort : undefined;
    const matchedModel = appModels.find(
      (model) =>
        model.apiModelId === scoutModel.apiModelId &&
        model.reasoning === scoutModel.reasoning
    );

    if (matchedModel) {
      return {
        ...matchedModel,
        id: scoutModel.id,
        apiModelId: scoutModel.apiModelId,
        name: scoutModel.name,
        description: scoutModel.description,
        reasoning: scoutModel.reasoning,
        reasoningEffort,
      };
    }

    return {
      ...scoutModel.fallback,
      id: scoutModel.id,
      apiModelId: scoutModel.apiModelId,
      name: scoutModel.name,
      description: scoutModel.description,
      reasoning: scoutModel.reasoning,
      reasoningEffort,
    };
  });
}

async function fetchAllAppModels(): Promise<AppModelDefinition[]> {
  return fetchAllAppModelsCached();
}

export async function fetchChatModels(): Promise<AppModelDefinition[]> {
  const appModels = await fetchAllAppModels();
  return buildScoutChatModels(appModels);
}

export async function getAppModelDefinition(
  modelId: AppModelId
): Promise<AppModelDefinition> {
  const models = await fetchAllAppModels();
  const scoutModel = buildScoutChatModels(models).find((m) => m.id === modelId);
  if (scoutModel) {
    return scoutModel;
  }
  const model = models.find((m) => m.id === modelId);
  if (!model) {
    throw new Error(`Model ${modelId} not found`);
  }
  return model;
}

/**
 * Set of model IDs from the generated models file.
 * Used to detect new models from the API that we haven't "decided" on yet.
 * When the snapshot was generated for a different gateway the IDs won't match,
 * so we fall back to an empty set (which auto-enables all models).
 */
const KNOWN_MODEL_IDS = new Set<string>(
  generatedForGateway === config.ai.gateway
    ? generatedModels.map((m) => m.id)
    : []
);

/**
 * Returns the default enabled models for a given list of app models.
 * Includes curated defaults + any new models from the API not in models.generated.ts
 */
export function getDefaultEnabledModels(
  appModels: AppModelDefinition[]
): Set<AppModelId> {
  const enabled = new Set<AppModelId>(config.ai.curatedDefaults);

  // If a curated default has a -reasoning variant, enable it too
  for (const model of appModels) {
    if (model.id.endsWith("-reasoning") && enabled.has(model.apiModelId)) {
      enabled.add(model.id);
    }
  }

  // Add any new models from the API that aren't in our generated snapshot
  for (const model of appModels) {
    if (!KNOWN_MODEL_IDS.has(model.apiModelId)) {
      enabled.add(model.id);
    }
  }

  return enabled;
}
