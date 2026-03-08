import { describe, expect, it } from "vitest";
import { sanitizeLeanFileName } from "./lean-file-name";

describe("sanitizeLeanFileName", () => {
  it("keeps safe lean file names intact", () => {
    expect(sanitizeLeanFileName("Example.lean")).toBe("Example.lean");
  });

  it("strips path segments and unsafe characters", () => {
    expect(sanitizeLeanFileName("../bad path/Weird File?.lean")).toBe(
      "Weird-File.lean"
    );
  });

  it("falls back to the default lean file name", () => {
    expect(sanitizeLeanFileName("../../")).toBe("Proof.lean");
  });
});
