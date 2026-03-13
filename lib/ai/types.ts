import type {
  InferUITool,
  LanguageModelUsage,
  UIMessage,
  UIMessageStreamWriter,
} from "ai";
import { z } from "zod";
import type { codeExecution } from "@/lib/ai/tools/code-execution";
import type { getWeather } from "@/lib/ai/tools/get-weather";
import type {
  aristotleCheckJob,
  leanProof,
} from "@/lib/ai/tools/lean-proof/lean-proof";
import type { retrieveUrl } from "@/lib/ai/tools/retrieve-url";
import type { tavilyWebSearch } from "@/lib/ai/tools/web-search";
import type { AppModelId } from "./app-models";
import type {
  CreateDocumentToolInput,
  DocumentToolResult,
  EditDocumentToolInput,
} from "./tools/documents/types";
import type { ResearchUpdate } from "./tools/research-updates-schema";

export const toolNameSchema = z.enum([
  "getWeather",
  "createTextDocument",
  "createCodeDocument",
  "createSheetDocument",
  "editTextDocument",
  "editCodeDocument",
  "editSheetDocument",
  "readDocument",
  "retrieveUrl",
  "webSearch",
  "codeExecution",
  "leanProof",
  "aristotleCheckJob",
  "generateImage",
  "generateVideo",
  "deepResearch",
]);

const _ = toolNameSchema.options satisfies ToolName[];

type ToolNameInternal = z.infer<typeof toolNameSchema>;

const frontendToolsSchema = z.enum([
  "webSearch",
  "deepResearch",
  "leanProof",
  "generateImage",
  "generateVideo",
  "createTextDocument",
  "createCodeDocument",
  "createSheetDocument",
  "editTextDocument",
  "editCodeDocument",
  "editSheetDocument",
]);

const __ = frontendToolsSchema.options satisfies ToolNameInternal[];

export type UiToolName = z.infer<typeof frontendToolsSchema>;
const messageMetadataSchema = z.object({
  createdAt: z.date(),
  parentMessageId: z.string().nullable(),
  selectedModel: z.custom<AppModelId>((val) => typeof val === "string"),
  activeStreamId: z.string().nullable(),
  selectedTool: frontendToolsSchema.optional(),
  usage: z.custom<LanguageModelUsage | undefined>((_val) => true).optional(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type UIToolDef<Input, Output> = {
  input: Input;
  output: Output;
};

type weatherTool = InferUITool<typeof getWeather>;
type createTextDocumentToolType = UIToolDef<
  CreateDocumentToolInput,
  DocumentToolResult
>;
type createCodeDocumentToolType = UIToolDef<
  CreateDocumentToolInput,
  DocumentToolResult
>;
type createSheetDocumentToolType = UIToolDef<
  CreateDocumentToolInput,
  DocumentToolResult
>;
type editTextDocumentToolType = UIToolDef<
  EditDocumentToolInput,
  DocumentToolResult
>;
type editCodeDocumentToolType = UIToolDef<
  EditDocumentToolInput,
  DocumentToolResult
>;
type editSheetDocumentToolType = UIToolDef<
  EditDocumentToolInput,
  DocumentToolResult
>;
type deepResearchTool = UIToolDef<
  Record<string, never>,
  | ({ format: "report" } & DocumentToolResult)
  | { answer: string; format: "clarifying_questions" }
  | { answer: string; format: "problem" }
>;
type readDocumentTool = UIToolDef<
  { documentId: string },
  | {
      content: string | null;
      createdAt: Date;
      documentId: string;
      kind: "code" | "sheet" | "text";
      title: string;
    }
  | { error: string }
>;
type generateImageTool = UIToolDef<
  { prompt: string },
  { imageUrl: string; prompt: string }
>;
type generateVideoTool = UIToolDef<
  {
    aspectRatio?: "16:9" | "9:16" | "1:1";
    durationSeconds?: number;
    prompt: string;
  },
  { prompt: string; videoUrl: string }
>;
type webSearchTool = InferUITool<ReturnType<typeof tavilyWebSearch>>;
type codeExecutionTool = InferUITool<ReturnType<typeof codeExecution>>;
type leanProofTool = InferUITool<ReturnType<typeof leanProof>>;
type aristotleCheckJobTool = InferUITool<ReturnType<typeof aristotleCheckJob>>;
type retrieveUrlTool = InferUITool<typeof retrieveUrl>;

// biome-ignore lint/style/useConsistentTypeDefinitions: ChatTools is consumed as a keyed alias across UI/tool generics.
export type ChatTools = {
  aristotleCheckJob: aristotleCheckJobTool;
  codeExecution: codeExecutionTool;
  createCodeDocument: createCodeDocumentToolType;
  createSheetDocument: createSheetDocumentToolType;
  createTextDocument: createTextDocumentToolType;
  deepResearch: deepResearchTool;
  editCodeDocument: editCodeDocumentToolType;
  editSheetDocument: editSheetDocumentToolType;
  editTextDocument: editTextDocumentToolType;
  generateImage: generateImageTool;
  generateVideo: generateVideoTool;
  getWeather: weatherTool;
  leanProof: leanProofTool;
  readDocument: readDocumentTool;
  retrieveUrl: retrieveUrlTool;
  webSearch: webSearchTool;
};

interface FollowupSuggestions {
  suggestions: string[];
}

export interface RunStatusData {
  detail?: string;
  label: string;
  phase:
    | "queued"
    | "starting"
    | "thinking"
    | "tool"
    | "waiting-aristotle"
    | "finalizing";
  startedAt: string;
  updatedAt: string;
}

// biome-ignore lint/style/useConsistentTypeDefinitions: Custom UI payloads rely on a discriminated type alias for UIMessage generics.
export type CustomUIDataTypes = {
  appendMessage: string;
  chatConfirmed: {
    chatId: string;
  };
  followupSuggestions: FollowupSuggestions;
  researchUpdate: ResearchUpdate;
  runStatus: RunStatusData;
};

export type ChatMessage = Omit<
  UIMessage<MessageMetadata, CustomUIDataTypes, ChatTools>,
  "metadata"
> & {
  metadata: MessageMetadata;
};

export type ToolName = keyof ChatTools;

export type ToolOutput<T extends ToolName> = ChatTools[T]["output"];

export type StreamWriter = UIMessageStreamWriter<ChatMessage>;

export interface Attachment {
  contentType: string;
  name: string;
  url: string;
}
