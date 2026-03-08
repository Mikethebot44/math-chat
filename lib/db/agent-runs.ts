import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import type {
  AgentRunCompletedPayload,
  AgentRunErrorPayload,
  AgentRunEventKind,
  AgentRunStatus,
  CreateAgentRunInput,
} from "@/lib/agent-runs/types";
import type { ChatMessage, ToolName } from "@/lib/ai/types";
import { generateUUID } from "@/lib/utils";
import { db } from "./client";
import {
  agentRun,
  agentRunEvent,
  chat,
  message,
  part,
  type Part,
} from "./schema";
import { mapDBPartsToUIParts, mapUIMessagePartsToDBParts } from "../utils/message-mapping";

function normalizeRequestedTools(requestedTools: ToolName[] | null) {
  return requestedTools && requestedTools.length > 0 ? requestedTools : null;
}

export async function createAgentRun(input: CreateAgentRunInput) {
  const [createdRun] = await db
    .insert(agentRun)
    .values({
      assistantMessageId: input.assistantMessageId,
      chatId: input.chatId,
      requestedTools: normalizeRequestedTools(input.requestedTools),
      selectedModel: input.selectedModel,
      userId: input.userId,
      userMessageId: input.userMessageId,
    })
    .returning();

  if (!createdRun) {
    throw new Error("Failed to create agent run");
  }

  await Promise.all([
    db
      .update(message)
      .set({ activeRunId: createdRun.id })
      .where(eq(message.id, input.assistantMessageId)),
    appendAgentRunEvent({
      kind: "run-queued",
      payload: {
        assistantMessageId: input.assistantMessageId,
        chatId: input.chatId,
        userMessageId: input.userMessageId,
      },
      runId: createdRun.id,
    }),
  ]);

  return createdRun;
}

export async function appendAgentRunEvent({
  runId,
  kind,
  payload,
}: {
  runId: string;
  kind: AgentRunEventKind;
  payload: unknown;
}) {
  const result = await db.transaction(async (tx) => {
    const current = await tx
      .select({
        sequence: sql<number>`coalesce(max(${agentRunEvent.sequence}), 0)`,
      })
      .from(agentRunEvent)
      .where(eq(agentRunEvent.runId, runId));

    const nextSequence = (current[0]?.sequence ?? 0) + 1;
    const [inserted] = await tx
      .insert(agentRunEvent)
      .values({
        kind,
        payload,
        runId,
        sequence: nextSequence,
      })
      .returning();

    if (!inserted) {
      throw new Error("Failed to append agent run event");
    }

    return inserted;
  });

  return {
    ...result,
    payload,
  };
}

export async function listAgentRunEvents({
  runId,
  sinceSequence = 0,
}: {
  runId: string;
  sinceSequence?: number;
}) {
  return db
    .select()
    .from(agentRunEvent)
    .where(
      and(
        eq(agentRunEvent.runId, runId),
        sql`${agentRunEvent.sequence} > ${sinceSequence}`
      )
    )
    .orderBy(asc(agentRunEvent.sequence));
}

export async function getAgentRunById({ id }: { id: string }) {
  const [run] = await db.select().from(agentRun).where(eq(agentRun.id, id));
  return run ?? null;
}

export async function getAgentRunForViewer({
  runId,
  userId,
}: {
  runId: string;
  userId: string;
}) {
  const [row] = await db
    .select({
      run: agentRun,
      chatUserId: chat.userId,
      chatVisibility: chat.visibility,
    })
    .from(agentRun)
    .innerJoin(chat, eq(chat.id, agentRun.chatId))
    .where(eq(agentRun.id, runId));

  if (!row) {
    return null;
  }

  if (row.chatVisibility !== "public" && row.chatUserId !== userId) {
    return null;
  }

  return row.run;
}

export async function getPendingAgentRunsByChat({
  chatId,
}: {
  chatId: string;
}) {
  return db
    .select()
    .from(agentRun)
    .where(
      and(
        eq(agentRun.chatId, chatId),
        inArray(agentRun.status, ["queued", "starting", "running"])
      )
    )
    .orderBy(desc(agentRun.createdAt));
}

export async function setAgentRunStatus({
  id,
  lastError,
  sandboxId,
  status,
}: {
  id: string;
  lastError?: AgentRunErrorPayload | null;
  sandboxId?: string | null;
  status: AgentRunStatus;
}) {
  const values: Partial<typeof agentRun.$inferInsert> = {
    status,
    updatedAt: new Date(),
  };

  if (status === "starting" || status === "running") {
    values.startedAt = new Date();
  }
  if (
    status === "completed" ||
    status === "failed" ||
    status === "cancelled"
  ) {
    values.finishedAt = new Date();
    values.leaseExpiresAt = null;
  }
  if (sandboxId !== undefined) {
    values.sandboxId = sandboxId;
  }
  if (lastError !== undefined) {
    values.lastError = lastError;
  }

  await db.update(agentRun).set(values).where(eq(agentRun.id, id));
}

export async function requestAgentRunCancellation({ runId }: { runId: string }) {
  await db
    .update(agentRun)
    .set({
      cancelRequestedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(agentRun.id, runId));
}

export async function clearMessageActiveRunId({
  messageId,
}: {
  messageId: string;
}) {
  await db
    .update(message)
    .set({ activeRunId: null, activeStreamId: null })
    .where(eq(message.id, messageId));
}

export async function renewAgentRunLease({
  leaseExpiresAt,
  runId,
}: {
  leaseExpiresAt: Date;
  runId: string;
}) {
  await db
    .update(agentRun)
    .set({ leaseExpiresAt, updatedAt: new Date() })
    .where(eq(agentRun.id, runId));
}

export async function claimNextAgentRun({
  leaseExpiresAt,
}: {
  leaseExpiresAt: Date;
}) {
  return db.transaction(async (tx) => {
    const result = await tx.execute(sql`
      select "id"
      from "AgentRun"
      where (
        "status" = 'queued'
        or (
          "status" in ('starting', 'running')
          and "leaseExpiresAt" is not null
          and "leaseExpiresAt" < now()
        )
      )
      and "cancelRequestedAt" is null
      and "attempt" < "maxAttempts"
      order by "priority" desc, "createdAt" asc
      for update skip locked
      limit 1;
    `);

    const row = result[0] as { id?: string } | undefined;
    if (!row?.id) {
      return null;
    }

    const [updatedRun] = await tx
      .update(agentRun)
      .set({
        attempt: sql`${agentRun.attempt} + 1`,
        leaseExpiresAt,
        status: "starting",
        updatedAt: new Date(),
      })
      .where(eq(agentRun.id, row.id))
      .returning();

    return updatedRun ?? null;
  });
}

export async function finalizeAgentRunSuccess({
  assistantMessage,
  chatId,
  runId,
}: {
  assistantMessage: ChatMessage;
  chatId: string;
  runId: string;
}) {
  await db.transaction(async (tx) => {
    const dbMessage = {
      annotations: null,
      attachments: [],
      createdAt: assistantMessage.metadata.createdAt,
      lastContext: assistantMessage.metadata.usage ?? null,
      parentMessageId: assistantMessage.metadata.parentMessageId,
      activeStreamId: null,
      activeRunId: null,
      selectedModel: assistantMessage.metadata.selectedModel,
      selectedTool: assistantMessage.metadata.selectedTool ?? "",
    };

    await tx
      .update(message)
      .set(dbMessage)
      .where(eq(message.id, assistantMessage.id));

    await tx.delete(part).where(eq(part.messageId, assistantMessage.id));
    const dbParts = mapUIMessagePartsToDBParts(
      assistantMessage.parts,
      assistantMessage.id
    );
    if (dbParts.length > 0) {
      await tx.insert(part).values(dbParts);
    }

    await tx
      .update(agentRun)
      .set({
        finishedAt: new Date(),
        leaseExpiresAt: null,
        status: "completed",
        updatedAt: new Date(),
      })
      .where(eq(agentRun.id, runId));

    await tx
      .update(chat)
      .set({ updatedAt: new Date() })
      .where(eq(chat.id, chatId));

    await tx
      .update(message)
      .set({ activeRunId: null })
      .where(eq(message.id, assistantMessage.id));
  });

  await appendAgentRunEvent({
    kind: "run-completed",
    payload: { completedAt: new Date().toISOString() } satisfies AgentRunCompletedPayload,
    runId,
  });
}

export async function finalizeAgentRunFailure({
  assistantMessageId,
  error,
  runId,
  status,
}: {
  assistantMessageId: string;
  error: AgentRunErrorPayload;
  runId: string;
  status: Extract<AgentRunStatus, "failed" | "cancelled">;
}) {
  await db.transaction(async (tx) => {
    await tx
      .update(message)
      .set({ activeRunId: null, activeStreamId: null })
      .where(eq(message.id, assistantMessageId));

    await tx
      .update(agentRun)
      .set({
        finishedAt: new Date(),
        leaseExpiresAt: null,
        lastError: error,
        status,
        updatedAt: new Date(),
      })
      .where(eq(agentRun.id, runId));
  });

  await appendAgentRunEvent({
    kind: status === "cancelled" ? "run-cancelled" : "run-failed",
    payload:
      status === "cancelled"
        ? { cancelledAt: new Date().toISOString() }
        : error,
    runId,
  });
}

export async function getAssistantMessageForRun({
  runId,
}: {
  runId: string;
}): Promise<ChatMessage | null> {
  const [row] = await db
    .select({
      dbMessage: message,
    })
    .from(agentRun)
    .innerJoin(message, eq(message.id, agentRun.assistantMessageId))
    .where(eq(agentRun.id, runId));

  if (!row) {
    return null;
  }

  const dbParts = await db
    .select()
    .from(part)
    .where(eq(part.messageId, row.dbMessage.id))
    .orderBy(asc(part.order));

  return {
    id: row.dbMessage.id,
    metadata: {
      activeRunId: row.dbMessage.activeRunId,
      activeStreamId: row.dbMessage.activeStreamId,
      createdAt: row.dbMessage.createdAt,
      parentMessageId: row.dbMessage.parentMessageId,
      selectedModel: row.dbMessage.selectedModel as ChatMessage["metadata"]["selectedModel"],
      selectedTool: (row.dbMessage.selectedTool ||
        undefined) as ChatMessage["metadata"]["selectedTool"],
      usage: row.dbMessage.lastContext as ChatMessage["metadata"]["usage"],
    },
    parts: dbParts.length > 0 ? mapDBPartsToUIParts(dbParts as Part[]) : [],
    role: row.dbMessage.role as ChatMessage["role"],
  };
}

export async function getLatestRunForMessage({
  assistantMessageId,
}: {
  assistantMessageId: string;
}) {
  const [run] = await db
    .select()
    .from(agentRun)
    .where(eq(agentRun.assistantMessageId, assistantMessageId))
    .orderBy(desc(agentRun.createdAt));

  return run ?? null;
}

export async function getRunByAssistantMessageId({
  assistantMessageId,
}: {
  assistantMessageId: string;
}) {
  const [run] = await db
    .select()
    .from(agentRun)
    .where(eq(agentRun.assistantMessageId, assistantMessageId));
  return run ?? null;
}
