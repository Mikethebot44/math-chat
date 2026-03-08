import { executeAgentRun } from "@/lib/agent-runs/execute-run";

async function main() {
  const runId = process.argv[2];

  if (!runId) {
    throw new Error("Usage: agent-run-sandbox.ts <runId>");
  }

  await executeAgentRun({ runId });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
