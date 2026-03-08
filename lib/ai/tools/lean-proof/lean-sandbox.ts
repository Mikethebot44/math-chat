import { CommandExitError, type CommandResult, Sandbox } from "e2b";
import { env } from "@/lib/env";
import { createModuleLogger } from "@/lib/logger";
import {
  containsLeanHoles,
  ensureMathlibImport,
} from "./normalize-lean-source";

const log = createModuleLogger("lean-proof:sandbox");

const DEFAULT_SANDBOX_TIMEOUT_MS = 180_000;
const DEFAULT_WORKSPACE_DIR = "/home/user/lean_workspace";
const DEFAULT_FILE_NAME = "Proof.lean";
const E2B_TIMEOUT_RE = /deadline_exceeded|timed out/i;

export interface LeanVerificationResult {
  command: string;
  containsHoles: boolean;
  diagnostics: string;
  exitCode: number;
  filePath: string;
  source: string;
  stderr: string;
  stdout: string;
  verified: boolean;
}

export function getLeanWorkspaceDir(): string {
  return env.E2B_LEAN_WORKSPACE_DIR ?? DEFAULT_WORKSPACE_DIR;
}

export function getLeanSandboxTimeoutMs(): number {
  return env.E2B_LEAN_TIMEOUT_MS ?? DEFAULT_SANDBOX_TIMEOUT_MS;
}

export function createLeanSandbox(): Promise<Sandbox> {
  if (!env.E2B_API_KEY) {
    throw new Error("E2B_API_KEY is not configured");
  }

  if (!env.E2B_LEAN_TEMPLATE_ID) {
    throw new Error("E2B_LEAN_TEMPLATE_ID is not configured");
  }

  return Sandbox.create(env.E2B_LEAN_TEMPLATE_ID, {
    timeoutMs: getLeanSandboxTimeoutMs(),
  });
}

export async function closeLeanSandbox(sandbox: Sandbox): Promise<void> {
  try {
    await sandbox.kill();
  } catch (error) {
    log.warn({ error, sandboxId: sandbox.sandboxId }, "failed to kill sandbox");
  }
}

export async function verifyLeanSource({
  sandbox,
  source,
  fileName = DEFAULT_FILE_NAME,
}: {
  sandbox: Sandbox;
  source: string;
  fileName?: string;
}): Promise<LeanVerificationResult> {
  const workspaceDir = getLeanWorkspaceDir();
  const normalizedSource = ensureMathlibImport(source);
  const filePath = `${workspaceDir}/${fileName}`;
  const command = `cd ${workspaceDir} && lake env lean ${fileName}`;

  await sandbox.files.write(filePath, normalizedSource);

  const stdoutParts: string[] = [];
  const stderrParts: string[] = [];

  let result: CommandResult;
  try {
    result = await sandbox.commands.run(command, {
      cwd: workspaceDir,
      onStdout: (chunk) => {
        stdoutParts.push(chunk);
      },
      onStderr: (chunk) => {
        stderrParts.push(chunk);
      },
      timeoutMs: getLeanSandboxTimeoutMs(),
    });
  } catch (error) {
    if (error instanceof CommandExitError) {
      result = error;
    } else if (error instanceof Error && E2B_TIMEOUT_RE.test(error.message)) {
      throw new Error(
        "Lean sandbox verification timed out. Rebuild the E2B Lean template so Mathlib is prewarmed, or increase E2B_LEAN_TIMEOUT_MS."
      );
    } else {
      throw error;
    }
  }

  const stdout = result.stdout || stdoutParts.join("");
  const stderr = result.stderr || stderrParts.join("");
  const diagnostics = [stdout, stderr].filter(Boolean).join("\n").trim();
  const containsHoles = containsLeanHoles(normalizedSource);

  return {
    command,
    containsHoles,
    diagnostics,
    exitCode: result.exitCode,
    filePath,
    source: normalizedSource,
    stderr,
    stdout,
    verified: result.exitCode === 0 && !containsHoles,
  };
}
