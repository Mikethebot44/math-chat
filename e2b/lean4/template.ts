import { Template } from "e2b";

const HOME_DIR = "/home/user";
const ELAN_BIN_DIR = `${HOME_DIR}/.elan/bin`;
const LEAN_WORKSPACE_DIR = `${HOME_DIR}/lean_workspace`;
const DEFAULT_LEAN_TOOLCHAIN = "leanprover/lean4:v4.24.0";
const DEFAULT_MATHLIB_REV = "v4.24.0";
const DEFAULT_WARMUP_FILE_NAME = "Warmup.lean";
const DEFAULT_WORKSPACE_LIBRARY = "LeanWorkspace";

export const lean4Toolchain =
  process.env.E2B_LEAN_TOOLCHAIN?.trim() || DEFAULT_LEAN_TOOLCHAIN;
export const lean4MathlibRev =
  process.env.E2B_LEAN_MATHLIB_REV?.trim() || DEFAULT_MATHLIB_REV;
export const lean4WorkspaceDir = LEAN_WORKSPACE_DIR;
export const lean4WarmupFileName = DEFAULT_WARMUP_FILE_NAME;
export const lean4TemplateName = "lean4-math-chat";

export const lean4Template = Template()
  .fromImage("e2bdev/code-interpreter:latest")
  .setUser("root")
  .runCmd(
    [
      "apt-get update",
      "apt-get install -y --no-install-recommends build-essential ca-certificates curl git zstd",
      "rm -rf /var/lib/apt/lists/*",
    ],
    { user: "root" }
  )
  .setUser("user")
  .setWorkdir(HOME_DIR)
  .runCmd(
    "curl -sSf https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh | bash -s -- -y"
  )
  .runCmd(
    `export PATH="${ELAN_BIN_DIR}:$PATH" && elan default ${lean4Toolchain}`
  )
  .runCmd(`export PATH="${ELAN_BIN_DIR}:$PATH" && lake new lean_workspace`)
  .setUser("root")
  .runCmd(
    [
      `ln -sf ${ELAN_BIN_DIR}/elan /usr/local/bin/elan`,
      `ln -sf ${ELAN_BIN_DIR}/lake /usr/local/bin/lake`,
      `ln -sf ${ELAN_BIN_DIR}/lean /usr/local/bin/lean`,
    ],
    { user: "root" }
  )
  .setUser("user")
  .setWorkdir(LEAN_WORKSPACE_DIR)
  .runCmd([
    "elan show",
    "lean --version",
    `printf '${lean4Toolchain}\\n' > lean-toolchain`,
    `printf '[package]\\nname = "lean_workspace"\\nversion = "0.1.0"\\ndefaultTargets = ["${DEFAULT_WORKSPACE_LIBRARY}"]\\n\\n[[lean_lib]]\\nname = "${DEFAULT_WORKSPACE_LIBRARY}"\\n\\n[[require]]\\nname = "mathlib"\\nscope = "leanprover-community"\\nrev = "${lean4MathlibRev}"\\n' > lakefile.toml`,
    `printf 'import Mathlib\\n' > ${DEFAULT_WORKSPACE_LIBRARY}.lean`,
    "lake update mathlib",
    "lake exe cache get",
    "lake build",
    `printf 'import Mathlib\\n\\ntheorem warmup_truth : True := by\\n  trivial\\n' > ${DEFAULT_WARMUP_FILE_NAME}`,
    `lake env lean ${DEFAULT_WARMUP_FILE_NAME}`,
    `printf '#!/usr/bin/env bash\\nset -euo pipefail\\ncd ${LEAN_WORKSPACE_DIR}\\nFILE="\${1:-Proof.lean}"\\nlake env lean "$FILE"\\n' > ${LEAN_WORKSPACE_DIR}/run-lean.sh`,
    `chmod +x ${LEAN_WORKSPACE_DIR}/run-lean.sh`,
  ]);
