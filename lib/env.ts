import type { StandardSchemaV1 } from "@t3-oss/env-core";
import { createEnv } from "@t3-oss/env-nextjs";
import { serverEnvSchema } from "./env-schema";

function formatValidationIssue(issue: StandardSchemaV1.Issue): string {
  const path =
    issue.path && issue.path.length > 0 ? issue.path.join(".") : "(root)";
  return `${path}: ${issue.message}`;
}

export const env = createEnv({
  server: serverEnvSchema,
  client: {},
  experimental__runtimeEnv: {},
  emptyStringAsUndefined: true,
  onValidationError: (issues) => {
    const details = issues.map(formatValidationIssue).join("; ");
    throw new Error(`Invalid environment variables: ${details}`);
  },
});
