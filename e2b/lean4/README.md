# Lean 4 E2B Template

This template builds an E2B sandbox with:

- Lean 4 via `elan`
- A Mathlib-backed Lake project at `/home/user/lean_workspace`
- Cached Mathlib artifacts for faster runtime verification

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

This builds in E2B's infrastructure and does not require Docker Desktop on your machine.

The legacy [`e2b.Dockerfile`](./e2b.Dockerfile) is kept only as a reference for the old build system.

This template now prebuilds the Lake workspace and warms a trivial Mathlib proof during image build. If you built an older template, rebuild it before testing the Lean pipeline or each sandbox will spend minutes compiling on first use.

## Runtime env

Set these server env vars for the Lean proof tool:

```bash
E2B_API_KEY=e2b_***
E2B_LEAN_TEMPLATE_ID=lean4-math-chat
ARISTOTLE_API_URL=https://aristotle.harmonic.fun/api/v1
ARISTOTLE_API_KEY=***
```

If Aristotle uses bearer auth instead of `x-api-key`, set `ARISTOTLE_BEARER_TOKEN` instead of `ARISTOTLE_API_KEY`.
