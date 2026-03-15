CREATE TABLE "ApiCompletion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"status" varchar(32) DEFAULT 'queued' NOT NULL,
	"model" varchar(64) NOT NULL,
	"requestMessages" json NOT NULL,
	"responseText" text,
	"leanFileName" text,
	"leanFileContent" text,
	"aristotleJobId" text,
	"errorCode" text,
	"errorMessage" text,
	"usagePromptTokens" integer,
	"usageCompletionTokens" integer,
	"creditsCharged" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "UserApiKey" (
	"userId" text PRIMARY KEY NOT NULL,
	"keyPrefix" varchar(32) NOT NULL,
	"keySuffix" varchar(8) NOT NULL,
	"keyHash" varchar(64) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"rotatedAt" timestamp DEFAULT now() NOT NULL,
	"lastUsedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "ApiCompletion" ADD CONSTRAINT "ApiCompletion_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "UserApiKey" ADD CONSTRAINT "UserApiKey_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ApiCompletion_user_id_idx" ON "ApiCompletion" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "ApiCompletion_status_created_at_idx" ON "ApiCompletion" USING btree ("status","createdAt");--> statement-breakpoint
CREATE INDEX "ApiCompletion_user_id_created_at_idx" ON "ApiCompletion" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "UserApiKey_hash_idx" ON "UserApiKey" USING btree ("keyHash");