import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const API_KEY_PREFIX = "scout_sk_";
const API_KEY_PREFIX_LENGTH = 8;
const API_KEY_SUFFIX_LENGTH = 4;

export function createApiKey() {
  const secret = randomBytes(24).toString("hex");
  const plaintext = `${API_KEY_PREFIX}${secret}`;

  return {
    plaintext,
    keyHash: hashApiKey(plaintext),
    keyPrefix: plaintext.slice(0, API_KEY_PREFIX.length + API_KEY_PREFIX_LENGTH),
    keySuffix: plaintext.slice(-API_KEY_SUFFIX_LENGTH),
  };
}

export function hashApiKey(apiKey: string) {
  return createHash("sha256").update(apiKey).digest("hex");
}

export function maskApiKey({
  keyPrefix,
  keySuffix,
}: {
  keyPrefix: string | null;
  keySuffix: string | null;
}) {
  if (!(keyPrefix && keySuffix)) {
    return null;
  }

  return `${keyPrefix}...${keySuffix}`;
}

export function verifyApiKeyHash({
  apiKey,
  keyHash,
}: {
  apiKey: string;
  keyHash: string;
}) {
  const computedHash = hashApiKey(apiKey);
  return timingSafeEqual(
    Buffer.from(computedHash, "utf8"),
    Buffer.from(keyHash, "utf8")
  );
}
