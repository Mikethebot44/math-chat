# Background Chat E2B Template

This template packages the app code needed to execute authenticated chat turns
inside a dedicated E2B sandbox.

Each sandbox runs the full durable turn lifecycle:

- model generation
- tool execution
- Aristotle polling and continuation
- final assistant message persistence

## Build

From the repo root:

```bash
npx tsx e2b/chat-agent/build.ts
```

Or via the package script:

```bash
npm run e2b:build:chat
```

To override the template name:

```bash
npm run e2b:build:chat -- my-chat-agent-template
```

## Runtime

Set these env vars on the app host and worker:

```bash
E2B_API_KEY=e2b_***
E2B_CHAT_TEMPLATE_ID=chat-agent-background
BACKGROUND_CHAT_E2B=true
NEXT_PUBLIC_BACKGROUND_CHAT_E2B=true
```

The worker consumes queued runs with:

```bash
npm run agent-runs:worker
```
