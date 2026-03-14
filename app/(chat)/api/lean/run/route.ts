import { Sandbox } from "e2b";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createLeanSandbox,
  getLeanSandboxTimeoutMs,
  verifyLeanSource,
} from "@/lib/ai/tools/lean-proof/lean-sandbox";
import {
  getAnonymousSession,
  setAnonymousSession,
} from "@/lib/anonymous-session-server";
import { auth } from "@/lib/auth";
import { createModuleLogger } from "@/lib/logger";
import { getRedisClient } from "@/lib/redis";
import { checkAnonymousRateLimit, getClientIP } from "@/lib/utils/rate-limit";

const log = createModuleLogger("api:lean:run");
const MISSING_CONFIGURATION_RE = /not configured/i;

const runLeanSchema = z.object({
  content: z.string(),
  fileName: z.string().trim().optional(),
  sandboxId: z.string().trim().min(1).nullable().optional(),
});

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to run Lean file";
}

function getClientSafeErrorMessage(errorMessage: string): string {
  return MISSING_CONFIGURATION_RE.test(errorMessage)
    ? errorMessage
    : "Failed to run Lean file";
}

async function getOrCreateLeanSandbox(
  sandboxId: string | null | undefined
): Promise<{ reusedSandbox: boolean; sandbox: Sandbox }> {
  if (sandboxId) {
    try {
      const sandbox = await Sandbox.connect(sandboxId);
      await sandbox.setTimeout(getLeanSandboxTimeoutMs());

      return {
        reusedSandbox: true,
        sandbox,
      };
    } catch (error) {
      log.warn({ error, sandboxId }, "failed to reconnect to lean sandbox");
    }
  }

  return {
    reusedSandbox: false,
    sandbox: await createLeanSandbox(),
  };
}

export async function POST(request: Request) {
  const requestHeaders = await headers();
  const [session, anonymousSession] = await Promise.all([
    auth.api.getSession({ headers: requestHeaders }),
    getAnonymousSession(),
  ]);

  if (!(session?.user?.id ?? anonymousSession?.id)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestBody = await request.json().catch(() => null);
  const parsedRequest = runLeanSchema.safeParse(requestBody);

  if (!parsedRequest.success) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  if (!session?.user && anonymousSession) {
    const rateLimitResult = await checkAnonymousRateLimit(
      getClientIP(request),
      await getRedisClient()
    );

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: rateLimitResult.error, type: "RATE_LIMIT_EXCEEDED" },
        { status: 429, headers: rateLimitResult.headers || {} }
      );
    }

    if (anonymousSession.remainingCredits <= 0) {
      return NextResponse.json(
        {
          error: "You've used your free credits. Sign up to continue chatting!",
          type: "ANONYMOUS_LIMIT_EXCEEDED",
          suggestion:
            "Create an account to get more credits and access to more AI models",
        },
        { status: 402, headers: rateLimitResult.headers || {} }
      );
    }

    await setAnonymousSession({
      ...anonymousSession,
      remainingCredits: anonymousSession.remainingCredits - 1,
    });
  }

  let sandbox: Sandbox | null = null;
  let reusedSandbox = false;

  try {
    const sandboxResult = await getOrCreateLeanSandbox(
      parsedRequest.data.sandboxId
    );
    sandbox = sandboxResult.sandbox;
    reusedSandbox = sandboxResult.reusedSandbox;

    const result = await verifyLeanSource({
      sandbox,
      source: parsedRequest.data.content,
      fileName: parsedRequest.data.fileName,
      ensureMathlib: false,
    });

    await sandbox.setTimeout(getLeanSandboxTimeoutMs());

    return NextResponse.json({
      ...result,
      reusedSandbox,
      sandboxId: sandbox.sandboxId,
    });
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    log.error(
      { error, reusedSandbox, sandboxId: sandbox?.sandboxId },
      "lean run failed"
    );

    if (sandbox && !reusedSandbox) {
      try {
        await sandbox.kill();
      } catch (killError) {
        log.warn(
          { error: killError, sandboxId: sandbox.sandboxId },
          "failed to kill lean sandbox after route error"
        );
      }
    }

    return NextResponse.json(
      { error: getClientSafeErrorMessage(errorMessage) },
      {
        status: MISSING_CONFIGURATION_RE.test(errorMessage) ? 503 : 500,
      }
    );
  }
}
