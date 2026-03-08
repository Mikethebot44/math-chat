import { tool } from "ai";
import { z } from "zod";
import {
  checkAristotleJobStatus,
  DEFAULT_ARISTOTLE_MODE,
  submitAristotleProblem,
} from "./aristotle-client";

const statusToolInputSchema = z.object({
  jobId: z.string().min(1).describe("Job ID returned by the submission tool."),
  waitForCompletion: z
    .boolean()
    .default(true)
    .describe(
      "When true, poll the job until it completes, fails, or maxWaitMs is reached."
    ),
  maxWaitMs: z
    .number()
    .int()
    .min(1000)
    .max(300_000)
    .default(90_000)
    .describe("Maximum time to wait while polling for completion."),
  pollIntervalMs: z
    .number()
    .int()
    .min(1000)
    .max(30_000)
    .default(5000)
    .describe("Delay between status checks while polling."),
});

export const leanProof = () =>
  tool({
    description: `Submit a natural-language math problem to the math agent.

Use this first for formalization or proof-generation requests.
- Input must be natural language only
- Do not include Lean code
- Do not include theorem names or sandbox instructions
- After submission, call aristotleCheckJob with the returned jobId to get progress and any available lean_code`,
    inputSchema: z.object({
      prompt: z
        .string()
        .min(1)
        .describe("Full natural-language math problem or theorem statement."),
      mode: z
        .enum([DEFAULT_ARISTOTLE_MODE])
        .default(DEFAULT_ARISTOTLE_MODE)
        .describe("Solve mode. Keep this at formalize_and_prove."),
    }),
    execute: async ({
      prompt,
      mode,
    }: {
      mode?: typeof DEFAULT_ARISTOTLE_MODE;
      prompt: string;
    }) =>
      submitAristotleProblem({
        mode,
        prompt,
      }),
  });

export const aristotleCheckJob = () =>
  tool({
    description: `Check the status of a math agent proof job.

Use this after leanProof returns a jobId.
- Set waitForCompletion to true when you want to keep polling for final Lean code
- Read leanCode from the tool output only when it is present`,
    inputSchema: statusToolInputSchema,
    execute: async ({
      jobId,
      waitForCompletion,
      maxWaitMs,
      pollIntervalMs,
    }: z.infer<typeof statusToolInputSchema>) =>
      checkAristotleJobStatus({
        jobId,
        maxWaitMs,
        pollIntervalMs,
        waitForCompletion,
      }),
  });
