import {
  Copy,
  Download,
  List,
  MessageSquare,
  Play,
  Redo2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { CodeEditor } from "@/components/code-editor";
import {
  Console,
  type ConsoleOutput,
  type ConsoleOutputContent,
} from "@/components/console";
import { Artifact } from "@/components/create-artifact";
import { config } from "@/lib/config";
import { env } from "@/lib/env";
import { generateUUID, getLanguageFromFileName } from "@/lib/utils";

const OUTPUT_HANDLERS = {
  matplotlib: `
    import io
    import base64
    from matplotlib import pyplot as plt

    # Clear any existing plots
    plt.clf()
    plt.close('all')

    # Switch to agg backend
    plt.switch_backend('agg')

    def setup_matplotlib_output():
        def custom_show():
            if plt.gcf().get_size_inches().prod() * plt.gcf().dpi ** 2 > 25_000_000:
                print("Warning: Plot size too large, reducing quality")
                plt.gcf().set_dpi(100)

            png_buf = io.BytesIO()
            plt.savefig(png_buf, format='png')
            png_buf.seek(0)
            png_base64 = base64.b64encode(png_buf.read()).decode('utf-8')
            print(f'data:image/png;base64,{png_base64}')
            png_buf.close()

            plt.clf()
            plt.close('all')

        plt.show = custom_show
  `,
  basic: `
    # Basic output capture setup
  `,
};

function detectRequiredHandlers(code: string): string[] {
  const handlers: string[] = ["basic"];

  if (code.includes("matplotlib") || code.includes("plt.")) {
    handlers.push("matplotlib");
  }

  return handlers;
}

interface Metadata {
  language: string;
  leanSandboxId: string | null;
  outputs: ConsoleOutput[];
}

interface LeanRunResponse {
  command: string;
  containsHoles: boolean;
  diagnostics: string;
  exitCode: number;
  filePath: string;
  reusedSandbox: boolean;
  sandboxId: string;
  stderr: string;
  stdout: string;
  verified: boolean;
}

const DEFAULT_LANGUAGE = "python";
const IS_LEAN_RUN_ENABLED = env.NEXT_PUBLIC_LEAN_RUN_ENABLED !== "false";

function createDefaultMetadata(language = DEFAULT_LANGUAGE): Metadata {
  return {
    outputs: [],
    language,
    leanSandboxId: null,
  };
}

function ensureMetadata(
  metadata: Metadata | null | undefined,
  language = DEFAULT_LANGUAGE
): Metadata {
  return {
    ...createDefaultMetadata(language),
    ...metadata,
    language: metadata?.language ?? language,
    leanSandboxId: metadata?.leanSandboxId ?? null,
    outputs: metadata?.outputs ?? [],
  };
}

function replaceConsoleOutput({
  metadata,
  runId,
  nextOutput,
}: {
  metadata: Metadata | null | undefined;
  runId: string;
  nextOutput: ConsoleOutput;
}): Metadata {
  const currentMetadata = ensureMetadata(metadata);

  return {
    ...currentMetadata,
    outputs: [
      ...currentMetadata.outputs.filter((output) => output.id !== runId),
      nextOutput,
    ],
  };
}

function isRunnableLanguage(language: string): boolean {
  if (language === "lean") {
    return IS_LEAN_RUN_ENABLED;
  }

  return language === "python";
}

async function runLeanCode({
  content,
  fileName,
  sandboxId,
}: {
  content: string;
  fileName: string;
  sandboxId: string | null;
}): Promise<LeanRunResponse> {
  const response = await fetch("/api/lean/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content,
      fileName,
      sandboxId,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | LeanRunResponse
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new Error(
      payload && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "Failed to run Lean file"
    );
  }

  return payload as LeanRunResponse;
}

function formatLeanRunOutput(result: LeanRunResponse): string {
  let statusSummary = "Lean reported errors.";

  if (result.exitCode === 0) {
    statusSummary = result.verified
      ? "Lean check passed."
      : "Lean compiled, but the file still contains holes such as `sorry` or `_`.";
  }

  const sections: string[] = [
    statusSummary,
    result.reusedSandbox
      ? "Reused the existing Lean sandbox."
      : "Started a new Lean sandbox from the prebuilt template.",
    `Command: ${result.command}`,
    `File: ${result.filePath}`,
  ];

  if (result.stdout.trim()) {
    sections.push(`stdout:\n${result.stdout.trim()}`);
  }

  if (result.stderr.trim()) {
    sections.push(`stderr:\n${result.stderr.trim()}`);
  } else if (result.diagnostics.trim()) {
    sections.push(`output:\n${result.diagnostics.trim()}`);
  }

  return sections.join("\n\n");
}

export const codeArtifact = new Artifact<"code", Metadata>({
  kind: "code",
  description:
    "Useful for code generation; Code execution is available for Python and Lean code.",
  initialize: ({ setMetadata }) => {
    setMetadata(createDefaultMetadata());
  },
  content: ({ isReadonly, content, title, ...props }) => {
    const language = getLanguageFromFileName(title) || DEFAULT_LANGUAGE;

    return (
      <CodeEditor
        {...props}
        content={content}
        isReadonly={isReadonly}
        language={language}
      />
    );
  },
  footer: ({ metadata, setMetadata }) => {
    if (!metadata?.outputs?.length) {
      return null;
    }

    return (
      <Console
        className="min-h-[200px]"
        consoleOutputs={metadata.outputs}
        setConsoleOutputs={() => {
          setMetadata((currentMetadata) => ({
            ...ensureMetadata(currentMetadata),
            outputs: [],
          }));
        }}
      />
    );
  },
  actions: [
    {
      icon: <Play size={18} />,
      label: "Run",
      description: "Execute code",
      isHidden: ({ title }) => {
        const language = getLanguageFromFileName(title) || DEFAULT_LANGUAGE;
        return language === "lean" && !IS_LEAN_RUN_ENABLED;
      },
      onClick: async ({ content, setMetadata, metadata, title }) => {
        const language = getLanguageFromFileName(title) || DEFAULT_LANGUAGE;
        const runId = generateUUID();
        const outputContent: ConsoleOutputContent[] = [];

        if (language === "lean") {
          const currentMetadata = ensureMetadata(metadata, language);
          const pendingMessage = currentMetadata.leanSandboxId
            ? "Reconnecting to the Lean sandbox..."
            : "Starting the Lean sandbox from the prebuilt template...";

          setMetadata((currentMetadata) => ({
            ...ensureMetadata(currentMetadata, language),
            outputs: [
              ...ensureMetadata(currentMetadata, language).outputs,
              {
                id: runId,
                contents: [{ type: "text", value: pendingMessage }],
                status: "loading_packages",
              },
            ],
          }));

          try {
            const result = await runLeanCode({
              content,
              fileName: title,
              sandboxId: currentMetadata.leanSandboxId,
            });

            setMetadata((currentMetadata) => {
              const nextMetadata = replaceConsoleOutput({
                metadata: ensureMetadata(currentMetadata, language),
                runId,
                nextOutput: {
                  id: runId,
                  contents: [
                    {
                      type: "text",
                      value: formatLeanRunOutput(result),
                    },
                  ],
                  status: result.exitCode === 0 ? "completed" : "failed",
                },
              });

              return {
                ...nextMetadata,
                language,
                leanSandboxId: result.sandboxId,
              };
            });
          } catch (error: any) {
            setMetadata((currentMetadata) =>
              replaceConsoleOutput({
                metadata: ensureMetadata(currentMetadata, language),
                runId,
                nextOutput: {
                  id: runId,
                  contents: [{ type: "text", value: error.message }],
                  status: "failed",
                },
              })
            );
          }

          return;
        }

        setMetadata((currentMetadata) => ({
          ...ensureMetadata(currentMetadata, language),
          outputs: [
            ...ensureMetadata(currentMetadata, language).outputs,
            {
              id: runId,
              contents: [],
              status: "in_progress",
            },
          ],
        }));

        try {
          // Python execution using Pyodide
          // @ts-expect-error - loadPyodide is not defined
          const currentPyodideInstance = await globalThis.loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.23.4/full/",
          });

          currentPyodideInstance.setStdout({
            batched: (output: string) => {
              outputContent.push({
                type: output.startsWith("data:image/png;base64")
                  ? "image"
                  : "text",
                value: output,
              });
            },
          });

          await currentPyodideInstance.loadPackagesFromImports(content, {
            messageCallback: (message: string) => {
              setMetadata((currentMetadata) =>
                replaceConsoleOutput({
                  metadata: ensureMetadata(currentMetadata, language),
                  runId,
                  nextOutput: {
                    id: runId,
                    contents: [{ type: "text", value: message }],
                    status: "loading_packages",
                  },
                })
              );
            },
          });

          const requiredHandlers = detectRequiredHandlers(content);
          for (const handler of requiredHandlers) {
            if (OUTPUT_HANDLERS[handler as keyof typeof OUTPUT_HANDLERS]) {
              await currentPyodideInstance.runPythonAsync(
                OUTPUT_HANDLERS[handler as keyof typeof OUTPUT_HANDLERS]
              );

              if (handler === "matplotlib") {
                await currentPyodideInstance.runPythonAsync(
                  "setup_matplotlib_output()"
                );
              }
            }
          }

          await currentPyodideInstance.runPythonAsync(content);

          setMetadata((currentMetadata) =>
            replaceConsoleOutput({
              metadata: ensureMetadata(currentMetadata, language),
              runId,
              nextOutput: {
                id: runId,
                contents: outputContent,
                status: "completed",
              },
            })
          );
        } catch (error: any) {
          setMetadata((currentMetadata) =>
            replaceConsoleOutput({
              metadata: ensureMetadata(currentMetadata, language),
              runId,
              nextOutput: {
                id: runId,
                contents: [{ type: "text", value: error.message }],
                status: "failed",
              },
            })
          );
        }
      },
      isDisabled: ({ isReadonly, title }) => {
        if (isReadonly) {
          return true;
        }
        const language = getLanguageFromFileName(title) || DEFAULT_LANGUAGE;
        return !isRunnableLanguage(language);
      },
    },
    {
      icon: <Undo2 size={18} />,
      description: "View Previous version",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("prev");
      },
      isDisabled: ({ currentVersionIndex }) => {
        if (currentVersionIndex === 0) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <Redo2 size={18} />,
      description: "View Next version",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("next");
      },
      isDisabled: ({ isCurrentVersion }) => {
        if (isCurrentVersion) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <Copy size={18} />,
      description: "Copy code to clipboard",
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success("Copied to clipboard!");
      },
    },
    {
      icon: <Download size={18} />,
      description: "Download file",
      onClick: ({ content, title }) => {
        const blob = new Blob([content], {
          type: "text/plain;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = title || "artifact.txt";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      },
    },
  ],
  toolbar: [
    {
      icon: <MessageSquare size={16} />,
      description: "Add comments",
      onClick: ({ sendMessage, storeApi }) => {
        sendMessage({
          role: "user",
          parts: [
            {
              type: "text",
              text: "Add comments to the code snippet for understanding",
            },
          ],
          metadata: {
            selectedModel: config.ai.tools.code.edits,
            createdAt: new Date(),
            parentMessageId: storeApi.getState().getLastMessageId(),
            activeStreamId: null,
          },
        });
      },
    },
    {
      icon: <List size={16} />,
      description: "Add logs",
      onClick: ({ sendMessage, storeApi }) => {
        sendMessage({
          role: "user",
          parts: [
            {
              type: "text",
              text: "Add logs to the code snippet for debugging",
            },
          ],
          metadata: {
            selectedModel: config.ai.tools.code.edits,
            createdAt: new Date(),
            parentMessageId: storeApi.getState().getLastMessageId(),
            activeStreamId: null,
          },
        });
      },
    },
  ],
});
