import "./load-env";
import { claimNextAgentRun } from "@/lib/db/agent-runs";
import { runAgentRunInSandbox } from "@/lib/agent-runs/e2b";
import { getAgentRunLeaseMs, isBackgroundChatEnabled } from "@/lib/agent-runs/config";
import { createModuleLogger } from "@/lib/logger";

const log = createModuleLogger("agent-runs:worker");

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processNextRun() {
  const leaseExpiresAt = new Date(Date.now() + getAgentRunLeaseMs());
  const run = await claimNextAgentRun({ leaseExpiresAt });
  if (!run) {
    return false;
  }

  log.info({ runId: run.id }, "claimed background agent run");
  await runAgentRunInSandbox({ runId: run.id });
  return true;
}

async function main() {
  if (!isBackgroundChatEnabled()) {
    throw new Error(
      "BACKGROUND_CHAT_E2B must be true and E2B chat env vars must be configured"
    );
  }

  const once = process.argv.includes("--once");

  do {
    const worked = await processNextRun();
    if (!worked) {
      await sleep(1000);
    }
  } while (!once);
}

main().catch((error) => {
  log.error({ error }, "agent run worker failed");
  process.exitCode = 1;
});
