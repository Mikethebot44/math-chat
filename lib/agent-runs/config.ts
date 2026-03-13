import { env } from "@/lib/env";

const DEFAULT_AGENT_RUN_LEASE_MS = 60_000;
const DEFAULT_AGENT_RUN_SANDBOX_TIMEOUT_MS = 45 * 60 * 1000;

export function isBackgroundChatEnabled(): boolean {
  return false;
}

export function getAgentRunLeaseMs(): number {
  return env.AGENT_RUN_LEASE_MS ?? DEFAULT_AGENT_RUN_LEASE_MS;
}

export function getAgentRunSandboxTimeoutMs(): number {
  return (
    env.AGENT_RUN_SANDBOX_TIMEOUT_MS ?? DEFAULT_AGENT_RUN_SANDBOX_TIMEOUT_MS
  );
}
