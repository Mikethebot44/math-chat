import { Sandbox } from "e2b";
import { appendAgentRunEvent, finalizeAgentRunFailure, getAgentRunById, renewAgentRunLease, setAgentRunStatus } from "@/lib/db/agent-runs";
import { buildRunStatusPart } from "@/lib/agent-runs/run-status";
import { env } from "@/lib/env";
import { createModuleLogger } from "@/lib/logger";
import { getAgentRunLeaseMs, getAgentRunSandboxTimeoutMs } from "./config";

const log = createModuleLogger("agent-runs:e2b");

const SANDBOX_ENV_ALLOWLIST = [
  "AI_GATEWAY_API_KEY",
  "APP_URL",
  "ARISTOTLE_API_KEY",
  "ARISTOTLE_API_URL",
  "ARISTOTLE_BEARER_TOKEN",
  "ARISTOTLE_PROJECT_TYPE",
  "ARISTOTLE_REQUEST_MODE",
  "ARISTOTLE_TIMEOUT_MS",
  "AUTH_SECRET",
  "BLOB_READ_WRITE_TOKEN",
  "DATABASE_URL",
  "EXA_API_KEY",
  "FIRECRAWL_API_KEY",
  "MCP_ENCRYPTION_KEY",
  "OPENAI_API_KEY",
  "OPENAI_COMPATIBLE_API_KEY",
  "OPENAI_COMPATIBLE_BASE_URL",
  "OPENROUTER_API_KEY",
  "REDIS_URL",
  "TAVILY_API_KEY",
  "VERCEL_OIDC_TOKEN",
] as const;

function getSandboxCommandEnvs(): Record<string, string> {
  const result: Record<string, string> = {
    NODE_ENV: process.env.NODE_ENV ?? "production",
  };

  for (const key of SANDBOX_ENV_ALLOWLIST) {
    const value = process.env[key];
    if (value) {
      result[key] = value;
    }
  }

  return result;
}

export async function runAgentRunInSandbox({ runId }: { runId: string }) {
  if (!env.E2B_API_KEY) {
    throw new Error("E2B_API_KEY is not configured");
  }

  if (!env.E2B_CHAT_TEMPLATE_ID) {
    throw new Error("E2B_CHAT_TEMPLATE_ID is not configured");
  }

  const sandbox = await Sandbox.create(env.E2B_CHAT_TEMPLATE_ID, {
    timeoutMs: getAgentRunSandboxTimeoutMs(),
  });

  const leaseMs = getAgentRunLeaseMs();
  const renewLease = async () => {
    await renewAgentRunLease({
      leaseExpiresAt: new Date(Date.now() + leaseMs),
      runId,
    });
  };

  const renewInterval = setInterval(() => {
    void renewLease().catch((error) => {
      log.error({ error, runId }, "failed to renew agent run lease");
    });
  }, Math.max(1000, Math.floor(leaseMs / 2)));

  try {
    await setAgentRunStatus({
      id: runId,
      sandboxId: sandbox.sandboxId,
      status: "starting",
    });
    await appendAgentRunEvent({
      kind: "status-update",
      payload: {
        part: buildRunStatusPart({
          label: "Starting sandbox...",
          phase: "starting",
          startedAt: new Date().toISOString(),
        }),
      },
      runId,
    });
    await renewLease();

    log.info({ runId, sandboxId: sandbox.sandboxId }, "starting sandbox run");

    const command = await sandbox.commands.run(
      `npx tsx scripts/agent-run-sandbox.ts ${runId}`,
      {
        cwd: "/workspace",
        envs: getSandboxCommandEnvs(),
        onStderr: (chunk) => {
          log.warn({ runId, sandboxId: sandbox.sandboxId, chunk }, "sandbox stderr");
        },
        onStdout: (chunk) => {
          log.debug({ runId, sandboxId: sandbox.sandboxId, chunk }, "sandbox stdout");
        },
        timeoutMs: getAgentRunSandboxTimeoutMs(),
      }
    );

    const latestRun = await getAgentRunById({ id: runId });
    if (
      command.exitCode !== 0 &&
      latestRun &&
      latestRun.status !== "failed" &&
      latestRun.status !== "cancelled" &&
      latestRun.status !== "completed"
    ) {
      await finalizeAgentRunFailure({
        assistantMessageId: latestRun.assistantMessageId,
        error: {
          details: {
            exitCode: command.exitCode,
            stderr: command.stderr,
            stdout: command.stdout,
          },
          message: command.error || "Sandbox command failed",
          retryable: false,
        },
        runId,
        status: "failed",
      });
    }
  } catch (error) {
    const latestRun = await getAgentRunById({ id: runId });
    if (
      latestRun &&
      latestRun.status !== "failed" &&
      latestRun.status !== "cancelled" &&
      latestRun.status !== "completed"
    ) {
      await finalizeAgentRunFailure({
        assistantMessageId: latestRun.assistantMessageId,
        error: {
          message:
            error instanceof Error ? error.message : "Sandbox execution failed",
          retryable: false,
        },
        runId,
        status: "failed",
      });
    }
    throw error;
  } finally {
    clearInterval(renewInterval);
    try {
      await sandbox.kill();
    } catch (error) {
      log.warn({ error, runId, sandboxId: sandbox.sandboxId }, "failed to kill sandbox");
    }
  }
}
