import { env } from "@/lib/env";
import { createModuleLogger } from "@/lib/logger";
import { stripProviderLeanHeader } from "./normalize-lean-source";

const log = createModuleLogger("lean-proof:aristotle");

export const DEFAULT_ARISTOTLE_MODE = "formalize_and_prove";

const DEFAULT_ARISTOTLE_TIMEOUT_MS = 180_000;
const DEFAULT_POLL_INTERVAL_MS = 5000;
const DEFAULT_STATUS_WAIT_MS = 90_000;
const DEFAULT_ARISTOTLE_API_BASE_URL = "https://aristotle.harmonic.fun/api/v1";
const DEFAULT_ARISTOTLE_PROJECT_TYPE = "3";
const ARISTOTLE_INVALID_LEAN_MARKER =
  "Aristotle failed to load this code into its environment.";
const LEADING_SLASH_RE = /^\/+/;
const ARISTOTLE_RESULT_DETAILS_RE = /Details:\s*([\s\S]*?)\n-\//;
const ARISTOTLE_RESULT_ERROR_RE = /ERROR\s+\d+:\s*([\s\S]*?)\n-\//;
const TRAILING_SLASH_RE = /\/+$/;

export type AristotleSolveMode = typeof DEFAULT_ARISTOTLE_MODE;

export interface AristotleJobSnapshot {
  completed: boolean;
  completedAt?: string;
  errorMessage: string | null;
  failed: boolean;
  jobId: string;
  leanCode: string;
  message: string;
  mode: AristotleSolveMode;
  progress: number | string | null;
  prompt?: string;
  rawResponse: unknown;
  startedAt?: string;
  status: string;
  summary: string;
  thoughtDurationMs?: number;
}

export interface AristotleJobStatusResult extends AristotleJobSnapshot {
  checksPerformed: number;
  timedOut: boolean;
  waitedMs: number;
}

function getAristotleTimeoutMs(): number {
  return env.ARISTOTLE_TIMEOUT_MS ?? DEFAULT_ARISTOTLE_TIMEOUT_MS;
}

function getDefaultStatusWaitMs(): number {
  return Math.min(getAristotleTimeoutMs(), DEFAULT_STATUS_WAIT_MS);
}

function getAristotleApiBaseUrl(): string {
  const configuredBaseUrl = env.ARISTOTLE_API_URL?.trim().replace(
    TRAILING_SLASH_RE,
    ""
  );

  return configuredBaseUrl || DEFAULT_ARISTOTLE_API_BASE_URL;
}

function getAristotleProjectType(): string {
  return env.ARISTOTLE_PROJECT_TYPE?.trim() || DEFAULT_ARISTOTLE_PROJECT_TYPE;
}

function hasAristotleCredentials(): boolean {
  return Boolean(env.ARISTOTLE_API_KEY || env.ARISTOTLE_BEARER_TOKEN);
}

function ensureAristotleConfigured(): void {
  if (!hasAristotleCredentials()) {
    throw new Error(
      "Set ARISTOTLE_API_KEY or ARISTOTLE_BEARER_TOKEN to call Aristotle"
    );
  }
}

function getAristotleHeaders({
  json = false,
}: {
  json?: boolean;
} = {}): Headers {
  ensureAristotleConfigured();

  const headers = new Headers({
    Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
  });

  if (json) {
    headers.set("Content-Type", "application/json");
  }

  if (env.ARISTOTLE_API_KEY) {
    headers.set("X-API-Key", env.ARISTOTLE_API_KEY);
  }

  if (env.ARISTOTLE_BEARER_TOKEN) {
    headers.set("Authorization", `Bearer ${env.ARISTOTLE_BEARER_TOKEN}`);
  }

  return headers;
}

interface AristotleProjectResponse {
  description?: string | null;
  file_name?: string | null;
  last_updated_at?: string;
  percent_complete?: number | null;
  project_id: string;
  status: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeLeanCode(leanCode: string | null): string {
  if (!leanCode) {
    return "";
  }

  return stripProviderLeanHeader(leanCode);
}

function normalizeStatus(status?: string | null): string {
  const trimmedStatus = status?.trim();
  return trimmedStatus || "PENDING";
}

function getAristotleLeanError(leanCode: string): string | null {
  if (!leanCode.includes(ARISTOTLE_INVALID_LEAN_MARKER)) {
    return null;
  }

  const parserError =
    leanCode.match(ARISTOTLE_RESULT_ERROR_RE)?.[1]?.trim() ||
    leanCode.match(ARISTOTLE_RESULT_DETAILS_RE)?.[1]?.trim();

  if (parserError) {
    return `Aristotle returned a Lean file that does not parse: ${parserError}`;
  }

  return "Aristotle returned a Lean file that does not parse.";
}

function isCompletedStatus(status: string): boolean {
  const normalizedStatus = status.toUpperCase();
  return [
    "COMPLETE",
    "COMPLETED",
    "SUCCESS",
    "SUCCEEDED",
    "DONE",
    "FINISHED",
  ].some((token) => normalizedStatus.includes(token));
}

function isFailedStatus(status: string): boolean {
  const normalizedStatus = status.toUpperCase();
  return ["FAILED", "ERROR", "CANCELED", "CANCELLED"].some((token) =>
    normalizedStatus.includes(token)
  );
}

function collectCandidateRecords(payload: unknown): Record<string, unknown>[] {
  const candidates: Record<string, unknown>[] = [];
  const seen = new Set<Record<string, unknown>>();
  const queue: unknown[] = [payload];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!isRecord(current) || seen.has(current)) {
      continue;
    }

    seen.add(current);
    candidates.push(current);

    for (const key of ["data", "result", "job", "response"]) {
      const nested = current[key];
      if (isRecord(nested)) {
        queue.push(nested);
      }
    }
  }

  return candidates;
}

function findStringInPayload(
  payload: unknown,
  keys: readonly string[]
): string | null {
  for (const record of collectCandidateRecords(payload)) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }

  return null;
}

function findProgress(payload: unknown): number | string | null {
  for (const record of collectCandidateRecords(payload)) {
    for (const key of ["percent_complete", "progress", "completion"]) {
      const value = record[key];
      if (typeof value === "number" || typeof value === "string") {
        return value;
      }
    }
  }

  return null;
}

function extractErrorMessage(payload: unknown): string {
  if (typeof payload === "string" && payload.trim()) {
    return payload.trim();
  }

  return (
    findStringInPayload(payload, [
      "detail",
      "message",
      "error",
      "status_description",
    ]) || "Aristotle request failed"
  );
}

function parseProjectResponse(payload: unknown): AristotleProjectResponse {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Aristotle returned an invalid project payload");
  }

  const project = payload as Record<string, unknown>;
  if (
    typeof project.project_id !== "string" ||
    typeof project.status !== "string"
  ) {
    throw new Error("Aristotle project payload is missing required fields");
  }

  return {
    project_id: project.project_id,
    status: project.status,
    description:
      typeof project.description === "string" ? project.description : null,
    file_name: typeof project.file_name === "string" ? project.file_name : null,
    last_updated_at:
      typeof project.last_updated_at === "string"
        ? project.last_updated_at
        : undefined,
    percent_complete:
      typeof project.percent_complete === "number"
        ? project.percent_complete
        : null,
  };
}

async function readAristotlePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  const trimmedText = text.trim();

  if (
    trimmedText.startsWith("{") ||
    trimmedText.startsWith("[") ||
    trimmedText.startsWith('"')
  ) {
    try {
      return JSON.parse(trimmedText);
    } catch {
      return text;
    }
  }

  return text;
}

function fetchAristotle({
  path,
  method = "GET",
  body,
}: {
  body?: BodyInit;
  method?: "GET" | "POST";
  path: string;
}): Promise<Response> {
  const normalizedPath = path.replace(LEADING_SLASH_RE, "");
  const url = new URL(normalizedPath, `${getAristotleApiBaseUrl()}/`);

  return fetch(url, {
    method,
    headers: getAristotleHeaders({ json: typeof body === "string" }),
    body,
    signal: AbortSignal.timeout(getAristotleTimeoutMs()),
  });
}

function formatProgress(progress: AristotleJobSnapshot["progress"]): string {
  if (progress === null) {
    return "";
  }

  if (typeof progress === "number") {
    return ` (${progress}% complete)`;
  }

  return ` (${progress})`;
}

function summarizeSnapshot(snapshot: AristotleJobSnapshot): string {
  if (snapshot.failed) {
    return `Aristotle job ${snapshot.jobId} failed with status ${snapshot.status}.`;
  }

  if (snapshot.completed && snapshot.leanCode) {
    return `Aristotle job ${snapshot.jobId} completed and returned Lean code.`;
  }

  if (snapshot.completed) {
    return `Aristotle job ${snapshot.jobId} completed.`;
  }

  return `Aristotle job ${snapshot.jobId} is ${snapshot.status}${formatProgress(snapshot.progress)}.`;
}

function buildSnapshot({
  payload,
  fallbackJobId,
  mode,
  prompt,
}: {
  fallbackJobId?: string;
  mode: AristotleSolveMode;
  payload: unknown;
  prompt?: string;
}): AristotleJobSnapshot {
  const jobId =
    findStringInPayload(payload, ["job_id", "jobId", "id"]) || fallbackJobId;

  if (!jobId) {
    throw new Error("Aristotle response did not include a job_id");
  }

  const rawLeanCode = normalizeLeanCode(
    findStringInPayload(payload, ["lean_code", "leanCode"])
  );
  const leanCodeError = getAristotleLeanError(rawLeanCode);
  const leanCode = leanCodeError ? "" : rawLeanCode;
  const status = leanCodeError
    ? "FAILED"
    : normalizeStatus(
        findStringInPayload(payload, ["status", "state", "job_status"])
      );
  const failed = Boolean(leanCodeError) || isFailedStatus(status);
  const completed =
    !failed && (leanCode.length > 0 || isCompletedStatus(status));
  const errorMessage =
    leanCodeError || (failed ? extractErrorMessage(payload) : null);

  const snapshot: AristotleJobSnapshot = {
    completed,
    errorMessage,
    failed,
    jobId,
    leanCode,
    mode,
    progress: findProgress(payload),
    prompt,
    rawResponse: payload,
    status,
    summary: "",
    message: "",
  };

  const summary = summarizeSnapshot(snapshot);

  return {
    ...snapshot,
    summary,
    message: errorMessage ? `${summary} ${errorMessage}` : summary,
  };
}

async function createAristotleProject({
  mode,
  prompt,
}: {
  mode: AristotleSolveMode;
  prompt: string;
}): Promise<AristotleProjectResponse> {
  const path = `/project?project_type=${getAristotleProjectType()}`;
  const attempts: Array<{
    body: BodyInit;
    label: string;
  }> = [
    {
      label: "json",
      body: JSON.stringify({ prompt, mode }),
    },
    {
      label: "multipart",
      body: (() => {
        const formData = new FormData();
        formData.append(
          "context",
          new Blob([prompt], { type: "text/plain" }),
          "prompt.txt"
        );
        return formData;
      })(),
    },
  ];

  const errors: string[] = [];

  for (const attempt of attempts) {
    const response = await fetchAristotle({
      path,
      method: "POST",
      body: attempt.body,
    });
    const payload = await readAristotlePayload(response);

    if (response.ok) {
      return parseProjectResponse(payload);
    }

    const errorMessage = `Aristotle project creation (${attempt.label}) failed with ${response.status}: ${extractErrorMessage(payload)}`;
    errors.push(errorMessage);
    log.warn(
      {
        attempt: attempt.label,
        status: response.status,
        response: payload,
      },
      "aristotle project creation attempt failed"
    );
  }

  throw new Error(errors.join(" | "));
}

async function solveAristotleProject({
  jobId,
  prompt,
}: {
  jobId: string;
  prompt: string;
}): Promise<AristotleProjectResponse> {
  const encodedPrompt = encodeURIComponent(prompt);
  const response = await fetchAristotle({
    path: `/project/${jobId}/solve?input_text=${encodedPrompt}`,
    method: "POST",
  });
  const payload = await readAristotlePayload(response);

  if (!response.ok) {
    throw new Error(
      `Aristotle solve request failed with ${response.status}: ${extractErrorMessage(payload)}`
    );
  }

  return parseProjectResponse(payload);
}

async function getAristotleProject(
  jobId: string
): Promise<AristotleProjectResponse> {
  const response = await fetchAristotle({
    path: `/project/${jobId}`,
  });
  const payload = await readAristotlePayload(response);

  if (!response.ok) {
    throw new Error(
      `Aristotle status check failed with ${response.status}: ${extractErrorMessage(payload)}`
    );
  }

  return parseProjectResponse(payload);
}

async function downloadAristotleResult(jobId: string): Promise<string> {
  const response = await fetchAristotle({
    path: `/project/${jobId}/result`,
  });
  const payload = await readAristotlePayload(response);

  if (!response.ok) {
    throw new Error(
      `Aristotle result download failed with ${response.status}: ${extractErrorMessage(payload)}`
    );
  }

  if (typeof payload !== "string") {
    throw new Error("Aristotle result payload was not plain text");
  }

  return normalizeLeanCode(payload);
}

export async function submitAristotleProblem({
  prompt,
  mode = DEFAULT_ARISTOTLE_MODE,
}: {
  mode?: AristotleSolveMode;
  prompt: string;
}): Promise<AristotleJobSnapshot> {
  const startedAt = new Date().toISOString();
  const createdProject = await createAristotleProject({
    mode,
    prompt,
  });
  const submittedProject = await solveAristotleProject({
    jobId: createdProject.project_id,
    prompt,
  });

  const snapshot = buildSnapshot({
    fallbackJobId: createdProject.project_id,
    mode,
    payload: submittedProject,
    prompt,
  });

  log.info(
    {
      jobId: snapshot.jobId,
      mode,
      status: snapshot.status,
    },
    "submitted aristotle job"
  );

  return {
    ...snapshot,
    startedAt,
  };
}

export async function getAristotleJob({
  jobId,
  mode = DEFAULT_ARISTOTLE_MODE,
}: {
  jobId: string;
  mode?: AristotleSolveMode;
}): Promise<AristotleJobSnapshot> {
  const project = await getAristotleProject(jobId);
  let leanCode = "";

  const status = normalizeStatus(project.status);
  if (isCompletedStatus(status)) {
    try {
      leanCode = await downloadAristotleResult(project.project_id);
    } catch (error) {
      log.warn(
        {
          error: error instanceof Error ? error.message : error,
          jobId: project.project_id,
        },
        "aristotle result download failed"
      );
    }
  }

  return buildSnapshot({
    fallbackJobId: jobId,
    mode,
    payload: {
      ...project,
      lean_code: leanCode,
    },
  });
}

export async function checkAristotleJobStatus({
  jobId,
  maxWaitMs = getDefaultStatusWaitMs(),
  mode = DEFAULT_ARISTOTLE_MODE,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  waitForCompletion = true,
}: {
  jobId: string;
  maxWaitMs?: number;
  mode?: AristotleSolveMode;
  pollIntervalMs?: number;
  waitForCompletion?: boolean;
}): Promise<AristotleJobStatusResult> {
  const startedAt = Date.now();
  const startedAtIso = new Date(startedAt).toISOString();
  let checksPerformed = 1;
  let snapshot = await getAristotleJob({ jobId, mode });

  while (
    waitForCompletion &&
    !snapshot.completed &&
    !snapshot.failed &&
    Date.now() - startedAt < maxWaitMs
  ) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    snapshot = await getAristotleJob({ jobId, mode });
    checksPerformed += 1;
  }

  const waitedMs = Date.now() - startedAt;
  const timedOut = waitForCompletion && !snapshot.completed && !snapshot.failed;
  const resolved = snapshot.completed || snapshot.failed;
  const completedAt = resolved
    ? new Date(startedAt + waitedMs).toISOString()
    : undefined;

  let summary = snapshot.summary;
  let message = snapshot.message;

  if (timedOut) {
    summary = `Aristotle job ${snapshot.jobId} is still ${snapshot.status} after waiting ${Math.round(waitedMs / 1000)}s.`;
    message = summary;
  }

  log.info(
    {
      checksPerformed,
      jobId: snapshot.jobId,
      status: snapshot.status,
      timedOut,
      waitedMs,
    },
    "checked aristotle job"
  );

  return {
    ...snapshot,
    checksPerformed,
    completedAt,
    message,
    summary,
    startedAt: startedAtIso,
    timedOut,
    thoughtDurationMs: resolved ? waitedMs : undefined,
    waitedMs,
  };
}
