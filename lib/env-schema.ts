import { z } from "zod";

/**
 * Server environment variable schemas with descriptions.
 *
 * Descriptions are the single source of truth used by:
 * - The CLI env checklist (derived at build time)
 * - The .env.example comments
 *
 * Exported separately from `env.ts` so the CLI can import
 * without triggering `createEnv` runtime validation.
 */
export const serverEnvSchema = {
  // Required core
  DATABASE_URL: z.string().min(1).describe("Postgres connection string"),
  AUTH_SECRET: z
    .string()
    .min(1)
    .describe("NextAuth.js secret for signing session tokens"),

  // Optional blob storage (enable in chat.config.ts)
  BLOB_READ_WRITE_TOKEN: z
    .string()
    .optional()
    .describe("Vercel Blob storage token for file uploads"),

  // Authentication providers (enable in chat.config.ts)
  AUTH_GOOGLE_ID: z.string().optional().describe("Google OAuth client ID"),
  AUTH_GOOGLE_SECRET: z
    .string()
    .optional()
    .describe("Google OAuth client secret"),
  AUTH_GITHUB_ID: z.string().optional().describe("GitHub OAuth app client ID"),
  AUTH_GITHUB_SECRET: z
    .string()
    .optional()
    .describe("GitHub OAuth app client secret"),
  VERCEL_APP_CLIENT_ID: z
    .string()
    .optional()
    .describe("Vercel OAuth integration client ID"),
  VERCEL_APP_CLIENT_SECRET: z
    .string()
    .optional()
    .describe("Vercel OAuth integration client secret"),

  // AI Gateway keys (one required depending on config.ai.gateway)
  AI_GATEWAY_API_KEY: z
    .string()
    .optional()
    .describe("Vercel AI Gateway API key"),
  VERCEL_OIDC_TOKEN: z
    .string()
    .optional()
    .describe("Vercel OIDC token (auto-set on Vercel deployments)"),
  OPENROUTER_API_KEY: z.string().optional().describe("OpenRouter API key"),
  OPENAI_COMPATIBLE_BASE_URL: z
    .string()
    .url()
    .optional()
    .describe("Base URL for OpenAI-compatible provider"),
  OPENAI_COMPATIBLE_API_KEY: z
    .string()
    .optional()
    .describe("API key for OpenAI-compatible provider"),
  OPENAI_API_KEY: z.string().optional().describe("OpenAI API key"),
  E2B_API_KEY: z.string().optional().describe("E2B API key"),
  E2B_CHAT_TEMPLATE_ID: z
    .string()
    .optional()
    .describe("E2B template name or ID for the background chat sandbox"),
  E2B_LEAN_TEMPLATE_ID: z
    .string()
    .optional()
    .describe("E2B template name or ID for the Lean 4 sandbox"),
  E2B_LEAN_WORKSPACE_DIR: z
    .string()
    .optional()
    .describe("Lean workspace directory inside the E2B sandbox"),
  E2B_LEAN_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .describe("Timeout in milliseconds for Lean sandbox execution"),
  BACKGROUND_CHAT_E2B: z
    .enum(["true", "false"])
    .optional()
    .describe("Enable authenticated background chat execution via E2B"),
  AGENT_RUN_LEASE_MS: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Lease duration in milliseconds for claimed background chat runs"
    ),
  AGENT_RUN_SANDBOX_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .describe("Timeout in milliseconds for an E2B background chat sandbox"),
  ARISTOTLE_API_URL: z
    .string()
    .url()
    .optional()
    .describe(
      "Optional Aristotle API base URL (defaults to https://aristotle.harmonic.fun/api/v1)"
    ),
  ARISTOTLE_API_KEY: z
    .string()
    .optional()
    .describe("Aristotle API key used as x-api-key"),
  ARISTOTLE_BEARER_TOKEN: z
    .string()
    .optional()
    .describe("Bearer token for Aristotle API requests"),
  ARISTOTLE_REQUEST_MODE: z
    .enum(["json", "multipart"])
    .optional()
    .describe("Aristotle request encoding mode"),
  ARISTOTLE_PROJECT_TYPE: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .describe(
      "Aristotle project type used for project-based solve requests (defaults to 3)"
    ),
  ARISTOTLE_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .describe("Timeout in milliseconds for Aristotle job requests"),

  // Optional cleanup cron job secret
  CRON_SECRET: z
    .string()
    .optional()
    .describe("Secret for cleanup cron job endpoint"),

  // Optional features (enable in chat.config.ts)
  REDIS_URL: z.string().optional().describe("Redis URL for resumable streams"),
  TAVILY_API_KEY: z
    .string()
    .optional()
    .describe("Tavily API key for web search"),
  EXA_API_KEY: z.string().optional().describe("Exa API key for web search"),
  FIRECRAWL_API_KEY: z
    .string()
    .optional()
    .describe("Firecrawl API key for web search and URL retrieval"),
  MCP_ENCRYPTION_KEY: z
    .union([z.string().length(44), z.literal("")])
    .optional()
    .describe("Encryption key for MCP server credentials (base64, 44 chars)"),

  // Sandbox (for non-Vercel deployments)
  VERCEL_TEAM_ID: z
    .string()
    .optional()
    .describe("Vercel team ID for sandbox (non-Vercel deployments)"),
  VERCEL_PROJECT_ID: z
    .string()
    .optional()
    .describe("Vercel project ID for sandbox (non-Vercel deployments)"),
  VERCEL_TOKEN: z
    .string()
    .optional()
    .describe("Vercel API token for sandbox (non-Vercel deployments)"),
  VERCEL_SANDBOX_RUNTIME: z
    .string()
    .optional()
    .describe("Vercel sandbox runtime identifier"),

  // App URL (for non-Vercel deployments) - full URL including https://
  APP_URL: z
    .url()
    .optional()
    .describe(
      "App URL for non-Vercel deployments (full URL including https://)"
    ),

  // Vercel platform (auto-set by Vercel)
  VERCEL_URL: z.string().optional().describe("Auto-set by Vercel platform"),
};

export const clientEnvSchema = {
  NEXT_PUBLIC_BACKGROUND_CHAT_E2B: z
    .enum(["true", "false"])
    .optional()
    .describe("Enable authenticated background chat execution in the browser"),
  NEXT_PUBLIC_LEAN_RUN_ENABLED: z
    .enum(["true", "false"])
    .optional()
    .describe("Enable the Lean canvas Run button in the browser"),
};
