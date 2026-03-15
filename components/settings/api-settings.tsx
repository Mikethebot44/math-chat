"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  RotateCcw,
  Terminal,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SettingsPageContent } from "@/components/settings/settings-page";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/react";

function formatDateTime(value: Date | string | null) {
  if (!value) {
    return "Never";
  }

  return new Date(value).toLocaleString();
}

async function copyToClipboard(value: string) {
  await navigator.clipboard.writeText(value);
}

const DEFAULT_API_DOCS_BASE_URL = "https://tryscout.dev";

function buildCurlCreateExample(baseUrl: string) {
  return [
    `curl -X POST ${baseUrl}/api/v1/chat/completions \\`,
    '  -H "Authorization: Bearer scout_sk_..." \\',
    '  -H "Content-Type: application/json" \\',
    '  -d "{\\"model\\":\\"Scout\\",\\"messages\\":[{\\"role\\":\\"user\\",\\"content\\":\\"Formalize and prove that 1 + 1 = 2 in Lean.\\"}]}"',
  ].join("\n");
}

function buildCurlPollExample(baseUrl: string) {
  return [
    `curl ${baseUrl}/api/v1/chat/completions/<completion-id> \\`,
    '  -H "Authorization: Bearer scout_sk_..."',
  ].join("\n");
}

function TerminalCommandBlock({ code }: { code: string }) {
  const [isCopied, setIsCopied] = useState(false);

  async function handleCopy() {
    try {
      await copyToClipboard(code);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error("Failed to copy command");
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border/60 bg-background/80">
      <div className="flex items-center justify-between border-border/50 border-b px-3 py-2">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          <Terminal className="size-3.5" />
          <span className="font-medium">Terminal</span>
        </div>
        <Button
          className="h-7 px-2 text-xs"
          onClick={() => {
            void handleCopy();
          }}
          type="button"
          variant="ghost"
        >
          {isCopied ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
          {isCopied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="terminal-command-scroll overflow-x-auto bg-transparent px-4 py-4 font-mono text-foreground text-xs leading-6 whitespace-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function ApiDocumentationCards() {
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_DOCS_BASE_URL);

  useEffect(() => {
    setApiBaseUrl(window.location.origin);
  }, []);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Create a completion</CardTitle>
          <CardDescription>
            Send a minimal OpenAI-style request to start a completion.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TerminalCommandBlock code={buildCurlCreateExample(apiBaseUrl)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Poll completion status</CardTitle>
          <CardDescription>
            Long-running Lean requests return <code>IN_PROGRESS</code> and
            should be polled until they complete.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TerminalCommandBlock code={buildCurlPollExample(apiBaseUrl)} />
        </CardContent>
      </Card>
    </>
  );
}

export function ApiKeySettings() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const apiAccessQuery = useQuery(trpc.settings.getApiAccess.queryOptions());

  const rotateApiKeyMutation = useMutation(
    trpc.settings.rotateApiKey.mutationOptions({
      onError: (error) => {
        toast.error(error.message || "Failed to rotate API key");
      },
      onSuccess: (result) => {
        setRevealedKey(result.apiKey);
        queryClient.setQueryData(trpc.settings.getApiAccess.queryKey(), {
          credits: result.credits,
          hasKey: result.hasKey,
          maskedKey: result.maskedKey,
          createdAt: result.createdAt,
          lastUsedAt: result.lastUsedAt,
          rotatedAt: result.rotatedAt,
        });
        toast.success("API key updated");
      },
    })
  );

  const hasKey = apiAccessQuery.data?.hasKey ?? false;

  return (
    <SettingsPageContent className="gap-6">
      <div className="max-w-4xl space-y-6">
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle>Account API key</CardTitle>
            <CardDescription>
              One key per account. Rotating it immediately invalidates the old
              key and future API usage spends from the same account credits as
              the app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-medium text-sm">
                <KeyRound className="size-4" />
                Current key
              </div>
              <div className="rounded-lg bg-muted px-4 py-4 font-mono text-sm break-all">
                {apiAccessQuery.isLoading
                  ? "Loading..."
                  : (apiAccessQuery.data?.maskedKey ??
                    "No API key generated yet")}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs uppercase tracking-wide">
                  Rotated
                </p>
                <p className="text-sm">
                  {formatDateTime(apiAccessQuery.data?.rotatedAt ?? null)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs uppercase tracking-wide">
                  Last used
                </p>
                <p className="text-sm">
                  {formatDateTime(apiAccessQuery.data?.lastUsedAt ?? null)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs uppercase tracking-wide">
                  Available credits
                </p>
                <p className="font-semibold text-2xl">
                  {apiAccessQuery.data?.credits ?? 0}
                </p>
              </div>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  className="w-full sm:w-auto"
                  disabled={
                    rotateApiKeyMutation.isPending || apiAccessQuery.isLoading
                  }
                  type="button"
                >
                  {rotateApiKeyMutation.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Updating key...
                    </>
                  ) : hasKey ? (
                    <>
                      <RotateCcw className="size-4" />
                      Rotate key
                    </>
                  ) : (
                    <>
                      <KeyRound className="size-4" />
                      Create key
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {hasKey ? "Rotate API key?" : "Create API key?"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {hasKey
                      ? "The current key will stop working immediately. Make sure any existing scripts are updated."
                      : "This creates the first API key for your account."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      void rotateApiKeyMutation.mutateAsync();
                    }}
                  >
                    {hasKey ? "Rotate key" : "Create key"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {revealedKey ? (
          <Card>
            <CardHeader>
              <CardTitle>Copy this key now</CardTitle>
              <CardDescription>
                This plaintext key is shown only once after creation or
                rotation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted px-4 py-4 font-mono text-sm break-all">
                {revealedKey}
              </div>
              <Button
                onClick={() =>
                  copyToClipboard(revealedKey).then(() =>
                    toast.success("API key copied")
                  )
                }
                type="button"
                variant="outline"
              >
                <Copy className="size-4" />
                Copy key
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </SettingsPageContent>
  );
}

export function ApiDocumentationSettings() {
  return (
    <SettingsPageContent className="gap-6">
      <div className="max-w-4xl space-y-6">
        <ApiDocumentationCards />
      </div>
    </SettingsPageContent>
  );
}
