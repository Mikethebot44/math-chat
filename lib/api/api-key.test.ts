import { describe, expect, it } from "vitest";
import { createApiKey, hashApiKey, maskApiKey, verifyApiKeyHash } from "./api-key";

describe("api-key", () => {
  it("creates a scout-prefixed API key with maskable metadata", () => {
    const apiKey = createApiKey();

    expect(apiKey.plaintext.startsWith("scout_sk_")).toBe(true);
    expect(apiKey.keyPrefix.startsWith("scout_sk_")).toBe(true);
    expect(apiKey.keySuffix.length).toBe(4);
    expect(maskApiKey(apiKey)).toBe(`${apiKey.keyPrefix}...${apiKey.keySuffix}`);
  });

  it("hashes and verifies the generated key", () => {
    const apiKey = createApiKey();

    expect(hashApiKey(apiKey.plaintext)).toBe(apiKey.keyHash);
    expect(
      verifyApiKeyHash({
        apiKey: apiKey.plaintext,
        keyHash: apiKey.keyHash,
      })
    ).toBe(true);
    expect(
      verifyApiKeyHash({
        apiKey: `${apiKey.plaintext}-bad`,
        keyHash: apiKey.keyHash,
      })
    ).toBe(false);
  });
});
