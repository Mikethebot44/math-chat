import { config } from "@/lib/config";
import { createModuleLogger } from "@/lib/logger";
import { getActiveGateway } from "./active-gateway";
import type { AiGatewayModel } from "./ai-gateway-models-schemas";
import type { ModelData } from "./model-data";
import { toModelData } from "./to-model-data";

const log = createModuleLogger("ai/models");
const MODEL_CACHE_TTL_MS = 60 * 60 * 1000;

let modelsCache:
  | {
      expiresAt: number;
      value: Promise<ModelData[]>;
    }
  | null = null;

async function fetchModelsRaw(): Promise<AiGatewayModel[]> {
  const activeGateway = getActiveGateway();

  log.debug({ gateway: activeGateway.type }, "Fetching models from gateway");

  try {
    const models = await activeGateway.fetchModels();
    log.info(
      { gateway: activeGateway.type, modelCount: models.length },
      "Successfully fetched models from gateway"
    );
    return models;
  } catch (error) {
    log.error(
      { err: error, gateway: activeGateway.type },
      "Error fetching models from gateway"
    );
    throw error;
  }
}

export async function fetchModels(): Promise<ModelData[]> {
  const now = Date.now();
  if (modelsCache && modelsCache.expiresAt > now) {
    return modelsCache.value;
  }

  const value = fetchModelsRaw()
    .then((models) => models.map(toModelData))
    .catch((error) => {
      modelsCache = null;
      throw error;
    });

  modelsCache = {
    expiresAt: now + MODEL_CACHE_TTL_MS,
    value,
  };

  return value;
}
