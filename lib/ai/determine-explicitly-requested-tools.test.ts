import { beforeEach, describe, expect, it, vi } from "vitest";

const config = vi.hoisted(() => ({
  ai: {
    tools: {
      leanProof: {
        enabled: true,
      },
    },
  },
  features: {
    sandbox: false,
  },
}));

const alwaysEnabledMathAgentTools = vi.hoisted(
  () => ["leanProof", "aristotleCheckJob"]
);

vi.mock("../config", () => ({
  config,
}));

vi.mock("./math-agent", () => ({
  ALWAYS_ENABLED_MATH_AGENT_TOOLS: alwaysEnabledMathAgentTools,
}));

import {
  determineExplicitlyRequestedTools,
  hasExplicitToolRestriction,
} from "./determine-explicitly-requested-tools";

describe("determineExplicitlyRequestedTools", () => {
  beforeEach(() => {
    config.ai.tools.leanProof.enabled = true;
    config.features.sandbox = false;
    alwaysEnabledMathAgentTools.splice(
      0,
      alwaysEnabledMathAgentTools.length,
      "leanProof",
      "aristotleCheckJob"
    );
  });

  it("disables tools entirely when document creation is unavailable", () => {
    expect(determineExplicitlyRequestedTools("createTextDocument")).toEqual([]);
  });

  it("keeps empty explicit restrictions distinct from no explicit selection", () => {
    alwaysEnabledMathAgentTools.splice(0, alwaysEnabledMathAgentTools.length);

    const defaultSelection = determineExplicitlyRequestedTools(null);
    const disabledDocumentSelection =
      determineExplicitlyRequestedTools("createTextDocument");

    expect(defaultSelection).toBeNull();
    expect(disabledDocumentSelection).toEqual([]);
    expect(hasExplicitToolRestriction(defaultSelection)).toBe(false);
    expect(hasExplicitToolRestriction(disabledDocumentSelection)).toBe(true);
  });

  it("returns the expected explicit tool for supported single-tool modes", () => {
    expect(determineExplicitlyRequestedTools("webSearch")).toEqual([
      "webSearch",
    ]);
    expect(determineExplicitlyRequestedTools("generateImage")).toEqual([
      "generateImage",
    ]);
  });
});
