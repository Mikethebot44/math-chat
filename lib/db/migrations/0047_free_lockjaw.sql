CREATE TABLE IF NOT EXISTS "UserPreference" (
	"userId" text PRIMARY KEY NOT NULL,
	"preferredName" varchar(50),
	"occupation" varchar(100),
	"assistantTraits" json DEFAULT '[]'::json NOT NULL,
	"additionalContext" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
	ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END
$$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UserPreference_user_id_idx" ON "UserPreference" USING btree ("userId");
