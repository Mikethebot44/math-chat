const LEAN_CODE_FENCE_RE = /^```(?:lean|lean4)?\s*|\s*```$/gim;
const IMPORT_MATHLIB_RE = /^\s*import\s+Mathlib\b/m;
const LEAN_HOLE_RE = /\b(?:sorry|admit)\b/;

export function stripLeanCodeFences(source: string): string {
  return source.replace(LEAN_CODE_FENCE_RE, "").trim();
}

export function ensureMathlibImport(source: string): string {
  const normalized = stripLeanCodeFences(source);

  if (IMPORT_MATHLIB_RE.test(normalized)) {
    return normalized;
  }

  return `import Mathlib\n\n${normalized}`;
}

export function containsLeanHoles(source: string): boolean {
  return LEAN_HOLE_RE.test(stripLeanCodeFences(source));
}
