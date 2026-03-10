"use client";

import { memo, useEffect } from "react";
import { useArtifact } from "@/hooks/use-artifact";
import {
  type DocumentToolResult,
  type DocumentToolType,
  getToolKind,
  isEditTool,
} from "@/lib/ai/tools/documents/types";
import type { ChatMessage } from "@/lib/ai/types";
import { useIsLastArtifact } from "@/lib/stores/hooks-message-parts";
import { DocumentPreview } from "./document-preview";

type DocumentTool = Extract<
  ChatMessage["parts"][number],
  { type: DocumentToolType }
>;

interface DocumentToolComponentProps {
  isReadonly: boolean;
  messageId: string;
  tool: DocumentTool;
}

function PureDocumentTool({
  tool,
  isReadonly,
  messageId,
}: DocumentToolComponentProps) {
  const { setArtifact } = useArtifact();
  const kind = getToolKind(tool.type);
  const isEdit = isEditTool(tool.type);
  const isLastArtifact = useIsLastArtifact(tool.toolCallId);
  const input = tool.input as
    | {
        content?: string;
        title?: string;
      }
    | undefined;
  const output = tool.output as DocumentToolResult | undefined;

  const inputTitle = input?.title ?? "";
  const inputContent = input?.content ?? "";

  // Sync streaming content to artifact panel
  useEffect(() => {
    if (tool.state === "input-streaming" || tool.state === "input-available") {
      setArtifact((prev) => ({
        ...prev,
        documentId: "init",
        title: inputTitle,
        content: inputContent,
        kind,
        messageId,
        status: "streaming",
        ...(prev.status !== "streaming" && { isVisible: true }),
      }));
    }

    if (tool.state === "output-available" && output) {
      if (output.status === "success") {
        setArtifact((prev) => ({
          ...prev,
          documentId: output.documentId,
          status: "idle",
          date: output.date,
        }));
      }
    }
  }, [tool.state, output, messageId, kind, inputTitle, inputContent, setArtifact]);

  if (tool.state === "output-error" || output?.status === "error") {
    const error = output?.status === "error" ? output.error : tool.errorText;

    return (
      <div className="rounded border p-2 text-red-500">Error: {error}</div>
    );
  }

  if (
    tool.state === "input-streaming" ||
    tool.state === "input-available" ||
    (tool.state === "output-available" && output)
  ) {
    return (
      <DocumentPreview
        input={{ title: inputTitle, kind, content: inputContent }}
        isLastArtifact={isLastArtifact}
        isReadonly={isReadonly}
        messageId={messageId}
        output={
          output?.status === "success"
            ? {
                documentId: output.documentId,
                title: inputTitle,
                kind,
              }
            : undefined
        }
        type={isEdit ? "update" : "create"}
      />
    );
  }

  return null;
}

export const DocumentTool = memo(
  PureDocumentTool,
  (prevProps, nextProps) =>
    prevProps.tool.state === nextProps.tool.state &&
    prevProps.tool.input?.title === nextProps.tool.input?.title &&
    prevProps.tool.input?.content === nextProps.tool.input?.content &&
    prevProps.tool.output === nextProps.tool.output &&
    prevProps.tool.errorText === nextProps.tool.errorText &&
    prevProps.isReadonly === nextProps.isReadonly &&
    prevProps.messageId === nextProps.messageId
);
