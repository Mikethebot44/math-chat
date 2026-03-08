import { Template } from "e2b";

const HOME_DIR = "/home/user";
const ELAN_BIN_DIR = `${HOME_DIR}/.elan/bin`;
const LEAN_WORKSPACE_DIR = `${HOME_DIR}/lean_workspace`;

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
  .runCmd(`export PATH="${ELAN_BIN_DIR}:$PATH" && lake new lean_workspace math`)
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
    "lake exe cache get",
    "lake build",
    "printf 'import Mathlib\\n\\ntheorem warmup_truth : True := by\\n  trivial\\n' > Warmup.lean",
    "lake env lean Warmup.lean",
    "lake env lean --version",
  ]);

export const lean4TemplateName = "lean4-math-chat";
export const lean4WorkspaceDir = LEAN_WORKSPACE_DIR;
