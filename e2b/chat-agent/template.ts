import path from "node:path";
import { fileURLToPath } from "node:url";
import { Template } from "e2b";

const WORKSPACE_DIR = "/workspace";
const TEMPLATE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEMPLATE_DIR, "../..");

const TEMPLATE_COPY_ITEMS = [
  { src: "app", dest: `${WORKSPACE_DIR}/app` },
  { src: "components", dest: `${WORKSPACE_DIR}/components` },
  { src: "hooks", dest: `${WORKSPACE_DIR}/hooks` },
  { src: "lib", dest: `${WORKSPACE_DIR}/lib` },
  { src: "providers", dest: `${WORKSPACE_DIR}/providers` },
  { src: "scripts", dest: `${WORKSPACE_DIR}/scripts` },
  { src: "trpc", dest: `${WORKSPACE_DIR}/trpc` },
  { src: "biome.jsonc", dest: `${WORKSPACE_DIR}/biome.jsonc` },
  { src: "chat.config.ts", dest: `${WORKSPACE_DIR}/chat.config.ts` },
  { src: "components.json", dest: `${WORKSPACE_DIR}/components.json` },
  { src: "drizzle.config.ts", dest: `${WORKSPACE_DIR}/drizzle.config.ts` },
  { src: "instrumentation.ts", dest: `${WORKSPACE_DIR}/instrumentation.ts` },
  { src: "next-env.d.ts", dest: `${WORKSPACE_DIR}/next-env.d.ts` },
  { src: "next.config.ts", dest: `${WORKSPACE_DIR}/next.config.ts` },
  { src: "package-lock.json", dest: `${WORKSPACE_DIR}/package-lock.json` },
  { src: "package.json", dest: `${WORKSPACE_DIR}/package.json` },
  { src: "postcss.config.mjs", dest: `${WORKSPACE_DIR}/postcss.config.mjs` },
  { src: "proxy.ts", dest: `${WORKSPACE_DIR}/proxy.ts` },
  { src: "tsconfig.json", dest: `${WORKSPACE_DIR}/tsconfig.json` },
  { src: "vercel.json", dest: `${WORKSPACE_DIR}/vercel.json` },
];

export const chatAgentTemplateName = "chat-agent-background";

export const chatAgentTemplate = Template({
  fileContextPath: REPO_ROOT,
})
  .fromImage("e2bdev/code-interpreter:latest")
  .setUser("root")
  .runCmd(
    [
      "apt-get update",
      "apt-get install -y --no-install-recommends ca-certificates curl git",
      "rm -rf /var/lib/apt/lists/*",
    ],
    { user: "root" }
  )
  .setUser("user")
  .setWorkdir(WORKSPACE_DIR)
  .copyItems(TEMPLATE_COPY_ITEMS)
  .runCmd("npm ci")
  .runCmd("npx next typegen .")
  .runCmd("npx tsc --noEmit --pretty false");
