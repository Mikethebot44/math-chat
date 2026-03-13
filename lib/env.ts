import type { StandardSchemaV1 } from "@t3-oss/env-core";
import { createEnv } from "@t3-oss/env-nextjs";
import { clientEnvSchema, serverEnvSchema } from "./env-schema";

function formatValidationIssue(issue: StandardSchemaV1.Issue): string {
  const path =
    issue.path && issue.path.length > 0 ? issue.path.join(".") : "(root)";
  return `${path}: ${issue.message}`;
}

export const env = createEnv({
  server: serverEnvSchema,
  client: clientEnvSchema,
  experimental__runtimeEnv: {
    NEXT_PUBLIC_ENABLE_ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS,
    NEXT_PUBLIC_LEAN_RUN_ENABLED: process.env.NEXT_PUBLIC_LEAN_RUN_ENABLED,
  },
  emptyStringAsUndefined: true,
  onValidationError: (issues) => {
    const details = issues.map(formatValidationIssue).join("; ");
    throw new Error(`Invalid environment variables: ${details}`);
  },
});
