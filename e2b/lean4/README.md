# Lean 4 E2B Template

This template builds an E2B sandbox with:

- Lean 4 via `elan`, pinned by default to `leanprover/lean4:v4.24.0`
- Mathlib pinned by default to the matching `v4.24.0` tag
- A Mathlib-backed Lake project at `/home/user/lean_workspace`
- Cached Mathlib artifacts for faster runtime verification
- A helper script at `/home/user/lean_workspace/run-lean.sh`

The recommended build path uses the E2B v2 Template SDK, not the deprecated
`e2b template build --path ...` Dockerfile flow.

## Build

From the repo root:

```bash
bun run e2b:build:lean
```

Or pass an explicit template name:

```bash
bun run e2b:build:lean -- lean4-math-chat
```

Or with explicit build sizing:

```bash
bun run e2b:build:lean -- --name lean4-math-chat --cpu 2 --memory 4096
```

Show CLI help:

```bash
bun run e2b:build:lean -- --help
```

This builds in E2B's infrastructure and does not require Docker Desktop on your machine.

The legacy [`e2b.Dockerfile`](./e2b.Dockerfile) is kept only as a reference for the old build system.

This template now prebuilds the Lake workspace and warms a trivial Mathlib proof during image build. If you built an older template, rebuild it before testing the Lean pipeline or each sandbox will spend minutes compiling on first use.

## Optional build env

These are only used by the template build script:

```bash
E2B_LEAN_TEMPLATE_NAME=lean4-math-chat
E2B_LEAN_TEMPLATE_CPU_COUNT=2
E2B_LEAN_TEMPLATE_MEMORY_MB=4096
E2B_LEAN_TOOLCHAIN=leanprover/lean4:v4.24.0
E2B_LEAN_MATHLIB_REV=v4.24.0
```

After the build finishes, set `E2B_LEAN_TEMPLATE_ID` in your app runtime env to either the returned template name or template id.

## Runtime env

Set these server env vars for the Lean proof tool:

```bash
E2B_API_KEY=e2b_***
E2B_LEAN_TEMPLATE_ID=lean4-math-chat
ARISTOTLE_API_URL=https://aristotle.harmonic.fun/api/v1
ARISTOTLE_API_KEY=***
```

If Aristotle uses bearer auth instead of `x-api-key`, set `ARISTOTLE_BEARER_TOKEN` instead of `ARISTOTLE_API_KEY`.
