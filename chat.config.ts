import type { ConfigInput } from "@/lib/config-schema";

/**
 * ChatJS Configuration
 *
 * Edit this file to customize your app.
 * @see https://chatjs.dev/docs/reference/config
 */
const config: ConfigInput = {
  appPrefix: "chat",
  appName: "Chat",
  appDescription: "AI chat powered by ChatJS",
  appUrl: "http://localhost:3000",
  organization: {
    name: "Your Organization",
    contact: {
      privacyEmail: "privacy@your-domain.com",
      legalEmail: "legal@your-domain.com",
    },
  },
  services: {
    hosting: "Vercel",
    aiProviders: ["OpenAI", "Anthropic", "Google"],
    paymentProcessors: [],
  },
  features: {
    sandbox: false,
    webSearch: false,
    urlRetrieval: false,
    deepResearch: false,
    mcp: false,
    imageGeneration: false,
    attachments: true, // File attachments (requires BLOB_READ_WRITE_TOKEN)
    followupSuggestions: false,
  },
  legal: {
    minimumAge: 13,
    governingLaw: "United States",
    refundPolicy: "no-refunds",
  },
  policies: {
    privacy: {
      title: "Privacy Policy",
    },
    terms: {
      title: "Terms of Service",
    },
  },
  authentication: {
    google: false, // Google OAuth (requires AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET)
    github: true, // GitHub OAuth (requires AUTH_GITHUB_ID + AUTH_GITHUB_SECRET)
    vercel: false, // Vercel OAuth (requires VERCEL_APP_CLIENT_ID + VERCEL_APP_CLIENT_SECRET)
  },
  ai: {
    gateway: "vercel",
    providerOrder: ["openai", "google", "anthropic"],
    disabledModels: [],
    curatedDefaults: [
      "openai/gpt-5-nano",
      "openai/gpt-5-mini",
      "openai/gpt-5.2",
      "openai/gpt-5.2-chat",
      "google/gemini-2.5-flash-lite",
      "google/gemini-3-flash",
      "google/gemini-3-pro-preview",
      "anthropic/claude-sonnet-4.5",
      "anthropic/claude-opus-4.5",
      "xai/grok-4",
    ],
    anonymousModels: ["google/gemini-2.5-flash-lite", "openai/gpt-5-nano"],
    workflows: {
      chat: "openai/gpt-5-mini",
      title: "openai/gpt-5-nano",
      pdf: "openai/gpt-5-mini",
      chatImageCompatible: "openai/gpt-4o-mini",
    },
    tools: {
      webSearch: {
        enabled: false,
      },
      urlRetrieval: {
        enabled: false,
      },
      codeExecution: {
        enabled: false,
      },
      leanProof: {
        enabled: true,
      },
      mcp: {
        enabled: false,
      },
      followupSuggestions: {
        enabled: false,
        default: "google/gemini-2.5-flash-lite",
      },
      text: {
        polish: "openai/gpt-5-mini",
      },
      sheet: {
        format: "openai/gpt-5-mini",
        analyze: "openai/gpt-5-mini",
      },
      code: {
        edits: "openai/gpt-5-mini",
      },
      image: {
        enabled: false,
        default: "google/gemini-3-pro-image",
      },
      video: {
        enabled: false,
        default: "xai/grok-imagine-video",
      },
      deepResearch: {
        enabled: false,
        defaultModel: "google/gemini-2.5-flash-lite",
        finalReportModel: "google/gemini-3-flash",
        allowClarification: true,
        maxResearcherIterations: 1,
        maxConcurrentResearchUnits: 2,
        maxSearchQueries: 2,
      },
    },
  },
  anonymous: {
    credits: 10, // Message credits for anonymous users
    availableTools: [], // Tools available to anonymous users
    rateLimit: {
      requestsPerMinute: 5,
      requestsPerMonth: 10,
    },
  },
  attachments: {
    maxBytes: 1_048_576, // Max file size in bytes after compression
    maxDimension: 2048, // Max image dimension
    acceptedTypes: {
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "application/pdf": [".pdf"],
    },
  },
};

export default config;
