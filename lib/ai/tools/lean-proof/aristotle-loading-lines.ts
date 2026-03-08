import type { ChatMessage } from "@/lib/ai/types";

export const ARISTOTLE_LOADING_LINE_COUNT = 10;
export const ARISTOTLE_LOADING_LINE_ROTATION_MS = 8000;

const MAX_PROMPT_LENGTH = 120;
const MAX_LINE_LENGTH = 72;
const TRAILING_PUNCTUATION_REGEX = /[.?!,:;]+$/g;
const LEADING_STATUS_DECORATION_REGEX = /^[-*•\d.\s"]+/u;
const LEADING_SINGLE_QUOTES_REGEX = /^'+|'+$/g;
const LEADING_DOUBLE_QUOTES_REGEX = /^"+|"+$/g;

const FALLBACK_VERBS = [
  "researching",
  "formalizing",
  "checking",
  "untangling",
  "testing",
  "proving",
  "matching",
  "discombobulating",
  "assembling",
  "verifying",
] as const;

type AristotleToolPart = Extract<
  ChatMessage["parts"][number],
  { type: "tool-leanProof" | "tool-aristotleCheckJob" }
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function trimToLength(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const trimmed = value.slice(0, maxLength + 1);
  const lastSpace = trimmed.lastIndexOf(" ");
  const candidate =
    lastSpace > Math.floor(maxLength * 0.6)
      ? trimmed.slice(0, lastSpace)
      : value.slice(0, maxLength);

  return candidate.trim();
}

function getTextParts(message: ChatMessage): string[] {
  return message.parts
    .filter(
      (part): part is Extract<ChatMessage["parts"][number], { type: "text" }> =>
        part.type === "text"
    )
    .map((part) => collapseWhitespace(part.text))
    .filter(Boolean);
}

function getPromptFromLeanProofInput(input: unknown): string | null {
  if (!isRecord(input) || typeof input.prompt !== "string") {
    return null;
  }

  const prompt = collapseWhitespace(input.prompt);
  return prompt || null;
}

function getPromptFromMessageToolParts(message: ChatMessage): string | null {
  for (const part of message.parts) {
    if (part.type !== "tool-leanProof") {
      continue;
    }

    const prompt = getPromptFromLeanProofInput(part.input);
    if (prompt) {
      return prompt;
    }
  }

  return null;
}

function normalizeLine(line: string): string {
  const cleaned = collapseWhitespace(
    line
      .replace(LEADING_STATUS_DECORATION_REGEX, "")
      .replace(LEADING_SINGLE_QUOTES_REGEX, "")
      .replace(LEADING_DOUBLE_QUOTES_REGEX, "")
      .replace(TRAILING_PUNCTUATION_REGEX, "")
  );

  if (!cleaned) {
    return "";
  }

  const trimmed = trimToLength(cleaned, MAX_LINE_LENGTH);
  return `${trimmed.slice(0, 1).toUpperCase()}${trimmed.slice(1)}...`;
}

export function normalizeAristotlePrompt(prompt: string): string {
  return trimToLength(collapseWhitespace(prompt), MAX_PROMPT_LENGTH);
}

export function getAristotlePromptForStatus({
  messageId,
  messages,
  tool,
}: {
  messageId: string;
  messages: ChatMessage[];
  tool: AristotleToolPart;
}): string | null {
  const directPrompt = getPromptFromLeanProofInput(tool.input);
  if (directPrompt) {
    return normalizeAristotlePrompt(directPrompt);
  }

  const currentMessage = messages.find((message) => message.id === messageId);
  if (!currentMessage) {
    return null;
  }

  const promptFromToolParts = getPromptFromMessageToolParts(currentMessage);
  if (promptFromToolParts) {
    return normalizeAristotlePrompt(promptFromToolParts);
  }

  let parentId = currentMessage.metadata.parentMessageId;
  while (parentId) {
    const parentMessage = messages.find((message) => message.id === parentId);
    if (!parentMessage) {
      break;
    }

    if (parentMessage.role === "user") {
      const text = getTextParts(parentMessage).join(" ");
      if (text) {
        return normalizeAristotlePrompt(text);
      }
    }

    parentId = parentMessage.metadata.parentMessageId;
  }

  return null;
}

export function buildFallbackAristotleLoadingLines(_prompt: string): string[] {
  return FALLBACK_VERBS.map((verb) => normalizeLine(verb));
}

export function finalizeAristotleLoadingLines({
  lines,
  prompt,
}: {
  lines: string[];
  prompt: string;
}): string[] {
  const fallback = buildFallbackAristotleLoadingLines(prompt);
  const deduped = new Set<string>();

  for (const line of lines) {
    const normalized = normalizeLine(line);
    if (normalized) {
      deduped.add(normalized);
    }
  }

  for (const line of fallback) {
    if (deduped.size >= ARISTOTLE_LOADING_LINE_COUNT) {
      break;
    }

    deduped.add(line);
  }

  return Array.from(deduped).slice(0, ARISTOTLE_LOADING_LINE_COUNT);
}

export function shuffleAristotleLoadingLines(lines: string[]): string[] {
  const shuffled = [...lines];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[nextIndex]] = [
      shuffled[nextIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}
