export const DEFAULT_LEAN_FILE_NAME = "Proof.lean";

const SAFE_LEAN_FILE_NAME_RE = /[^A-Za-z0-9._-]+/g;
const LEAN_FILE_PATH_SEPARATOR_RE = /[\\/]/;
const LEAN_FILE_EXTENSION_RE = /\.lean$/i;

export function sanitizeLeanFileName(fileName: string | undefined): string {
  const trimmedFileName = fileName?.trim() ?? "";
  const baseName =
    trimmedFileName
      .split(LEAN_FILE_PATH_SEPARATOR_RE)
      .at(-1)
      ?.replace(LEAN_FILE_EXTENSION_RE, "") ?? "";
  const sanitizedBaseName = baseName
    .replace(SAFE_LEAN_FILE_NAME_RE, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "")
    .slice(0, 80);

  return sanitizedBaseName
    ? `${sanitizedBaseName}.lean`
    : DEFAULT_LEAN_FILE_NAME;
}
