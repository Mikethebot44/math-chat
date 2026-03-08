import {
  HighlightStyle,
  StreamLanguage,
  type StringStream,
  syntaxHighlighting,
} from "@codemirror/language";
import { tags } from "@lezer/highlight";

const LEAN_KEYWORDS = new Set([
  "abbrev",
  "axiom",
  "by",
  "class",
  "def",
  "do",
  "else",
  "example",
  "extends",
  "forall",
  "fun",
  "have",
  "if",
  "import",
  "inductive",
  "in",
  "instance",
  "lemma",
  "let",
  "match",
  "namespace",
  "noncomputable",
  "notation",
  "open",
  "private",
  "protected",
  "structure",
  "syntax",
  "term",
  "theorem",
  "variable",
  "where",
  "with",
]);

const LEAN_ATOMS = new Set(["False", "Prop", "Sort", "True", "Type"]);

const DEFINITION_KEYWORDS = new Set([
  "abbrev",
  "axiom",
  "class",
  "def",
  "example",
  "inductive",
  "instance",
  "lemma",
  "notation",
  "structure",
  "syntax",
  "theorem",
]);

const LEAN_NUMBER_RE = /0x[0-9a-fA-F]+|0b[01]+|\d+(?:\.\d+)?/;
const LEAN_OPERATOR_RE = /[:!#$%&*+/<=>?@\\^|~`-]+/;
const LEAN_PUNCTUATION_RE = /[()[\]{}.,;]/;
const LEAN_IDENTIFIER_RE = /[A-Za-z_\u00A0-\uFFFF][\w'\u00A0-\uFFFF]*/;
const LEAN_UPPERCASE_RE = /^[A-Z]/;

interface LeanState {
  blockCommentDepth: number;
  definitionPending: boolean;
  inString: boolean;
}

function consumeUntilLineEnd(stream: StringStream) {
  while (!stream.eol()) {
    stream.next();
  }
}

function consumeBlockComment(stream: StringStream, state: LeanState) {
  while (!stream.eol()) {
    if (stream.match("/-")) {
      state.blockCommentDepth += 1;
      continue;
    }

    if (stream.match("-/")) {
      state.blockCommentDepth -= 1;
      if (state.blockCommentDepth <= 0) {
        state.blockCommentDepth = 0;
        return;
      }
      continue;
    }

    stream.next();
  }
}

function consumeString(stream: StringStream, state: LeanState) {
  let escaped = false;

  while (!stream.eol()) {
    const next = stream.next();
    if (!next) {
      break;
    }

    if (escaped) {
      escaped = false;
      continue;
    }

    if (next === "\\") {
      escaped = true;
      continue;
    }

    if (next === '"') {
      state.inString = false;
      return;
    }
  }
}

function readIdentifierToken(token: string, state: LeanState) {
  if (state.definitionPending) {
    state.definitionPending = false;
    return LEAN_UPPERCASE_RE.test(token)
      ? "typeName.definition"
      : "variableName.definition";
  }

  if (DEFINITION_KEYWORDS.has(token)) {
    state.definitionPending = true;
    return "definitionKeyword";
  }

  if (LEAN_KEYWORDS.has(token)) {
    return "keyword";
  }

  if (LEAN_ATOMS.has(token)) {
    return "atom";
  }

  return LEAN_UPPERCASE_RE.test(token) ? "typeName" : "variableName";
}

function readStructuredToken(stream: StringStream, state: LeanState) {
  if (stream.match("--")) {
    consumeUntilLineEnd(stream);
    return "comment";
  }

  if (stream.match("/-")) {
    state.blockCommentDepth = 1;
    consumeBlockComment(stream, state);
    return "comment";
  }

  if (stream.peek() === '"') {
    stream.next();
    state.inString = true;
    consumeString(stream, state);
    return "string";
  }

  if (stream.match(LEAN_NUMBER_RE)) {
    state.definitionPending = false;
    return "number";
  }

  if (stream.match(LEAN_OPERATOR_RE)) {
    state.definitionPending = false;
    return "operator";
  }

  if (stream.match(LEAN_PUNCTUATION_RE)) {
    state.definitionPending = false;
    return "punctuation";
  }

  if (stream.match(LEAN_IDENTIFIER_RE)) {
    return readIdentifierToken(stream.current(), state);
  }

  return null;
}

export const leanLanguage = StreamLanguage.define<LeanState>({
  name: "lean",
  startState: () => ({
    blockCommentDepth: 0,
    definitionPending: false,
    inString: false,
  }),
  token: (stream, state) => {
    if (state.blockCommentDepth > 0) {
      consumeBlockComment(stream, state);
      return "comment";
    }

    if (state.inString) {
      consumeString(stream, state);
      return "string";
    }

    if (stream.eatSpace()) {
      return null;
    }

    const token = readStructuredToken(stream, state);
    if (token) {
      return token;
    }

    state.definitionPending = false;
    stream.next();
    return null;
  },
});

const leanHighlightStyle = HighlightStyle.define([
  {
    tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment],
    color: "var(--muted-foreground)",
    fontStyle: "italic",
  },
  {
    tag: [tags.keyword, tags.definitionKeyword, tags.controlKeyword],
    color: "var(--primary)",
    fontWeight: "600",
  },
  {
    tag: [tags.typeName, tags.atom, tags.bool],
    color:
      "color-mix(in oklch, var(--accent-foreground) 80%, var(--foreground))",
  },
  {
    tag: [tags.definition(tags.variableName), tags.definition(tags.typeName)],
    color: "color-mix(in oklch, var(--foreground) 82%, var(--primary))",
    fontWeight: "600",
  },
  {
    tag: [tags.string, tags.special(tags.string)],
    color:
      "color-mix(in oklch, var(--accent-foreground) 68%, var(--foreground))",
  },
  {
    tag: [tags.number, tags.integer, tags.float],
    color: "color-mix(in oklch, var(--primary) 58%, var(--foreground))",
  },
  {
    tag: [tags.operator, tags.punctuation, tags.bracket],
    color: "color-mix(in oklch, var(--foreground) 78%, var(--primary))",
  },
  {
    tag: [tags.variableName, tags.propertyName],
    color: "var(--foreground)",
  },
]);

export const leanEditorExtensions = [
  leanLanguage,
  syntaxHighlighting(leanHighlightStyle),
];
