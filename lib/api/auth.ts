import { getUserApiKeyByHash, touchUserApiKeyLastUsedAt } from "@/lib/db/api-access";
import { hashApiKey, verifyApiKeyHash } from "./api-key";

function getBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim();
}

export async function authenticateApiKey({
  authorizationHeader,
}: {
  authorizationHeader: string | null;
}) {
  const apiKey = getBearerToken(authorizationHeader);
  if (!apiKey) {
    return null;
  }

  const keyHash = hashApiKey(apiKey);
  const apiKeyRow = await getUserApiKeyByHash({ keyHash });
  if (!apiKeyRow) {
    return null;
  }

  if (!verifyApiKeyHash({ apiKey, keyHash: apiKeyRow.keyHash })) {
    return null;
  }

  await touchUserApiKeyLastUsedAt({ userId: apiKeyRow.userId });

  return {
    userId: apiKeyRow.userId,
  };
}
