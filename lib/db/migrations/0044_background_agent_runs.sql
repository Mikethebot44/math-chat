ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "activeRunId" uuid;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "AgentRun" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chatId" uuid NOT NULL,
	"userId" text NOT NULL,
	"userMessageId" uuid NOT NULL,
	"assistantMessageId" uuid NOT NULL,
	"selectedModel" varchar(256) NOT NULL,
	"requestedTools" json,
	"status" varchar(32) DEFAULT 'queued' NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"maxAttempts" integer DEFAULT 2 NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"sandboxId" varchar(128),
	"leaseExpiresAt" timestamp,
	"startedAt" timestamp,
	"finishedAt" timestamp,
	"cancelRequestedAt" timestamp,
	"lastError" json,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "AgentRunEvent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"runId" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"kind" varchar(64) NOT NULL,
	"payload" json NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'AgentRun_chatId_Chat_id_fk'
	) THEN
		ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'AgentRun_userId_user_id_fk'
	) THEN
		ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'AgentRun_userMessageId_Message_id_fk'
	) THEN
		ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_userMessageId_Message_id_fk" FOREIGN KEY ("userMessageId") REFERENCES "public"."Message"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'AgentRun_assistantMessageId_Message_id_fk'
	) THEN
		ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_assistantMessageId_Message_id_fk" FOREIGN KEY ("assistantMessageId") REFERENCES "public"."Message"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'AgentRunEvent_runId_AgentRun_id_fk'
	) THEN
		ALTER TABLE "AgentRunEvent" ADD CONSTRAINT "AgentRunEvent_runId_AgentRun_id_fk" FOREIGN KEY ("runId") REFERENCES "public"."AgentRun"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "AgentRun_chat_id_idx" ON "AgentRun" USING btree ("chatId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "AgentRun_user_id_idx" ON "AgentRun" USING btree ("userId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "AgentRun_status_priority_created_idx" ON "AgentRun" USING btree ("status","priority","createdAt");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "AgentRun_assistant_message_id_idx" ON "AgentRun" USING btree ("assistantMessageId");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "AgentRunEvent_run_id_sequence_idx" ON "AgentRunEvent" USING btree ("runId","sequence");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "AgentRunEvent_run_id_created_idx" ON "AgentRunEvent" USING btree ("runId","createdAt");
