const FENCED_MATH_LANGUAGES = new Set(["katex", "latex", "math", "tex"]);

type Segment = {
  type: "code" | "text";
  value: string;
};

export function normalizeMathMarkdown(text: string): string {
  if (!shouldNormalizeMathMarkdown(text)) {
    return text;
  }

  return splitMarkdownByCode(text)
    .map((segment) =>
      segment.type === "code"
        ? normalizeMathCodeSegment(segment.value)
        : normalizeMathTextSegment(segment.value)
    )
    .join("");
}

function shouldNormalizeMathMarkdown(text: string): boolean {
  return (
    text.includes("\\[") ||
    text.includes("\\(") ||
    text.includes("$") ||
    text.includes("```")
  );
}

function splitMarkdownByCode(text: string): Segment[] {
  const segments: Segment[] = [];
  let buffer = "";
  let activeFenceLength: number | null = null;

  for (let index = 0; index < text.length; ) {
    if (text[index] !== "`") {
      buffer += text[index];
      index += 1;
      continue;
    }

    let runLength = 1;
    while (text[index + runLength] === "`") {
      runLength += 1;
    }

    const fence = text.slice(index, index + runLength);

    if (activeFenceLength === null) {
      if (buffer) {
        segments.push({ type: "text", value: buffer });
      }
      buffer = fence;
      activeFenceLength = runLength;
      index += runLength;
      continue;
    }

    buffer += fence;
    index += runLength;

    if (runLength === activeFenceLength) {
      segments.push({ type: "code", value: buffer });
      buffer = "";
      activeFenceLength = null;
    }
  }

  if (buffer) {
    segments.push({
      type: activeFenceLength === null ? "text" : "code",
      value: buffer,
    });
  }

  return segments;
}

function normalizeMathCodeSegment(segment: string): string {
  const match = segment.match(/^(`{3,})([^\r\n]*)\r?\n([\s\S]*?)\r?\n\1[ \t]*$/);

  if (!match) {
    return segment;
  }

  const [, , rawInfoString, body] = match;
  const [language = ""] = rawInfoString.trim().split(/\s+/);

  if (!FENCED_MATH_LANGUAGES.has(language.toLowerCase())) {
    return segment;
  }

  const content = body.trim();
  if (!content) {
    return segment;
  }

  return `$$\n${content}\n$$`;
}

function normalizeMathTextSegment(segment: string): string {
  let normalized = segment.replace(
    /\\\[((?:\\.|[\s\S])*?)\\\]/g,
    (match, content, offset, source) => {
      if (offset > 0 && source[offset - 1] === "\\") {
        return match;
      }

      return wrapBlockMath(content, offset, match.length, source);
    }
  );

  normalized = normalized.replace(
    /\\\(((?:\\.|[\s\S])*?)\\\)/g,
    (match, content, offset, source) => {
      if (offset > 0 && source[offset - 1] === "\\") {
        return match;
      }

      return wrapInlineMath(content);
    }
  );

  return normalizeSingleDollarMath(normalized);
}

function wrapBlockMath(
  content: string,
  offset: number,
  length: number,
  source: string
): string {
  const trimmed = content.trim();
  if (!trimmed) {
    return source.slice(offset, offset + length);
  }

  const prefix =
    offset > 0 && !isLineBreak(source[offset - 1]) ? "\n" : "";
  const suffixIndex = offset + length;
  const suffix =
    suffixIndex < source.length && !isLineBreak(source[suffixIndex]) ? "\n" : "";

  return `${prefix}$$\n${trimmed}\n$$${suffix}`;
}

function wrapInlineMath(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) {
    return content;
  }

  if (trimmed.includes("\n") || trimmed.includes("\r")) {
    return `$$\n${trimmed}\n$$`;
  }

  return `$$${trimmed}$$`;
}

function normalizeSingleDollarMath(segment: string): string {
  let normalized = "";

  for (let index = 0; index < segment.length; ) {
    if (segment[index] !== "$") {
      normalized += segment[index];
      index += 1;
      continue;
    }

    const previous = segment[index - 1];
    const next = segment[index + 1];

    if (previous === "\\" || next === "$") {
      normalized += segment[index];
      index += 1;
      continue;
    }

    const closingIndex = findClosingSingleDollar(segment, index + 1);
    if (closingIndex === -1) {
      normalized += segment[index];
      index += 1;
      continue;
    }

    const content = segment.slice(index + 1, closingIndex);
    if (!shouldNormalizeSingleDollarMath(content)) {
      normalized += segment[index];
      index += 1;
      continue;
    }

    normalized += wrapInlineMath(content);
    index = closingIndex + 1;
  }

  return normalized;
}

function findClosingSingleDollar(segment: string, startIndex: number): number {
  for (let index = startIndex; index < segment.length; index += 1) {
    if (segment[index] !== "$") {
      continue;
    }

    const previous = segment[index - 1];
    const next = segment[index + 1];

    if (previous === "\\" || previous === "$" || next === "$") {
      continue;
    }

    return index;
  }

  return -1;
}

function shouldNormalizeSingleDollarMath(content: string): boolean {
  const trimmed = content.trim();

  if (!trimmed || trimmed.includes("\n") || trimmed.includes("\r")) {
    return false;
  }

  if (/^[\d.,]+$/.test(trimmed) || /^[A-Za-z]{2,}$/.test(trimmed)) {
    return false;
  }

  if (/\\[A-Za-z]+/.test(trimmed) || /[{}^_=<>]/.test(trimmed)) {
    return true;
  }

  if (/[+\-*/]/.test(trimmed) && /[A-Za-z0-9]/.test(trimmed)) {
    return true;
  }

  if (/^[A-Za-z](?:[0-9]+)?$/.test(trimmed)) {
    return true;
  }

  if (/^[A-Z](?:_[A-Z0-9]+)+$/.test(trimmed)) {
    return true;
  }

  if (/^[A-Za-z](?:_[A-Za-z0-9{}]+|\^[A-Za-z0-9{}]+)+$/.test(trimmed)) {
    return true;
  }

  return /^[A-Za-z][A-Za-z0-9]*\([^)]*\)$/.test(trimmed);
}

function isLineBreak(value: string | undefined): boolean {
  return value === "\n" || value === "\r";
}
