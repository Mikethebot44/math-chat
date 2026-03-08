import { createModuleLogger } from "@/lib/logger";
import { getActiveGateway } from "./active-gateway";
import type { AiGatewayModel } from "./ai-gateway-models-schemas";
import type { ModelData } from "./model-data";
import { toModelData } from "./to-model-data";

const log = createModuleLogger("ai/models");
const MODEL_CACHE_TTL_MS = 60 * 60 * 1000;

let modelsCache: Promise<ModelData[]> | null = null;

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

export function fetchModels(): Promise<ModelData[]> {
  if (modelsCache) {
    return modelsCache;
  }

  let timeoutId: ReturnType<typeof setTimeout>;
  const value = fetchModelsRaw()
    .then((models) => models.map(toModelData))
    .catch((error) => {
      clearTimeout(timeoutId);
      modelsCache = null;
      throw error;
    });
  timeoutId = setTimeout(() => {
    modelsCache = null;
  }, MODEL_CACHE_TTL_MS);
  timeoutId.unref?.();

  modelsCache = value;

  return value;
}
