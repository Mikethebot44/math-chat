import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { normalizeMathMarkdown } from "./normalize-math-markdown";

describe("normalizeMathMarkdown", () => {
  it("normalizes bracket display math", () => {
    const normalized = normalizeMathMarkdown(
      "We want \\[\\lim_{n\\to\\infty}\\frac{E(n)}{n^2}.\\]"
    );

    assert.equal(
      normalized,
      "We want \n$$\n\\lim_{n\\to\\infty}\\frac{E(n)}{n^2}.\n$$"
    );
  });

  it("normalizes parenthesized inline math", () => {
    assert.equal(
      normalizeMathMarkdown("The limit is \\(n^2 / 8\\)."),
      "The limit is $$n^2 / 8$$."
    );
  });

  it("normalizes math-like single dollar expressions without touching currency", () => {
    assert.equal(
      normalizeMathMarkdown("Use $x^2$ but keep prices like $5 and $10 unchanged."),
      "Use $$x^2$$ but keep prices like $5 and $10 unchanged."
    );
  });

  it("converts fenced latex blocks into display math", () => {
    assert.equal(
      normalizeMathMarkdown("```latex\n\\frac{1}{2}\n```"),
      "$$\n\\frac{1}{2}\n$$"
    );
  });

  it("leaves non-math code segments alone", () => {
    const source =
      "Inline `\\(x^2\\)` stays code.\n\n```ts\nconst equation = \"\\\\[x\\\\]\";\n```";

    assert.equal(normalizeMathMarkdown(source), source);
  });
});
