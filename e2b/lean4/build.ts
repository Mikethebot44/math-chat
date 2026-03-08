import "../../scripts/load-env";
import { defaultBuildLogger, Template } from "e2b";
import {
  lean4MathlibRev,
  lean4Template,
  lean4TemplateName,
  lean4Toolchain,
} from "./template";

const DEFAULT_CPU_COUNT = 2;
const DEFAULT_MEMORY_MB = 4096;

interface BuildOptions {
  cpuCount: number;
  help: boolean;
  memoryMB: number;
  templateName: string;
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  label: string
): number {
  if (!value) {
    return fallback;
  }

  const parsedValue = Number.parseInt(value, 10);
  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }

  return parsedValue;
}

function printHelp(): void {
  console.log(`Build the Lean 4 E2B template.

Usage:
  bun run e2b:build:lean
  bun run e2b:build:lean -- <template-name>
  bun run e2b:build:lean -- --name <template-name> --cpu 2 --memory 4096

Optional environment variables:
  E2B_LEAN_TEMPLATE_NAME
  E2B_LEAN_TEMPLATE_CPU_COUNT
  E2B_LEAN_TEMPLATE_MEMORY_MB
  E2B_LEAN_TOOLCHAIN
  E2B_LEAN_MATHLIB_REV
`);
}

function getBuildOptions(): BuildOptions {
  const args = process.argv.slice(2);
  let templateName =
    process.env.E2B_LEAN_TEMPLATE_NAME?.trim() || lean4TemplateName;
  let cpuCount = parsePositiveInteger(
    process.env.E2B_LEAN_TEMPLATE_CPU_COUNT,
    DEFAULT_CPU_COUNT,
    "E2B_LEAN_TEMPLATE_CPU_COUNT"
  );
  let memoryMB = parsePositiveInteger(
    process.env.E2B_LEAN_TEMPLATE_MEMORY_MB,
    DEFAULT_MEMORY_MB,
    "E2B_LEAN_TEMPLATE_MEMORY_MB"
  );
  let help = false;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }

    if (arg === "--name") {
      templateName = args[index + 1] || templateName;
      index++;
      continue;
    }

    if (arg === "--cpu") {
      cpuCount = parsePositiveInteger(args[index + 1], cpuCount, "--cpu");
      index++;
      continue;
    }

    if (arg === "--memory") {
      memoryMB = parsePositiveInteger(args[index + 1], memoryMB, "--memory");
      index++;
      continue;
    }

    if (!arg.startsWith("-")) {
      templateName = arg;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    cpuCount,
    help,
    memoryMB,
    templateName,
  };
}

async function main() {
  const options = getBuildOptions();

  if (options.help) {
    printHelp();
    return;
  }

  if (!process.env.E2B_API_KEY) {
    throw new Error("E2B_API_KEY is required to build the Lean 4 E2B template");
  }

  const buildInfo = await Template.build(lean4Template, options.templateName, {
    cpuCount: options.cpuCount,
    memoryMB: options.memoryMB,
    onBuildLogs: defaultBuildLogger(),
  });

  console.log(`
Built Lean E2B template successfully.
  name: ${buildInfo.name}
  templateId: ${buildInfo.templateId}
  buildId: ${buildInfo.buildId}
  leanToolchain: ${lean4Toolchain}
  mathlibRev: ${lean4MathlibRev}
  cpuCount: ${options.cpuCount}
  memoryMB: ${options.memoryMB}

Set one of these in your runtime env:
  E2B_LEAN_TEMPLATE_ID=${buildInfo.name}
  E2B_LEAN_TEMPLATE_ID=${buildInfo.templateId}
`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
