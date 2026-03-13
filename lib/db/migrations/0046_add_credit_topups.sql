CREATE TABLE "CreditTopUp" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"amountCents" integer NOT NULL,
	"creditsToAdd" integer NOT NULL,
	"status" varchar(32) DEFAULT 'initiated' NOT NULL,
	"stripeCheckoutSessionId" text,
	"stripePaymentIntentId" text,
	"failureReason" text,
	"completedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "CreditTopUp" ADD CONSTRAINT "CreditTopUp_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "CreditTopUp_user_id_idx" ON "CreditTopUp" USING btree ("userId");
--> statement-breakpoint
CREATE INDEX "CreditTopUp_status_idx" ON "CreditTopUp" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX "CreditTopUp_checkout_session_idx" ON "CreditTopUp" USING btree ("stripeCheckoutSessionId");
--> statement-breakpoint
CREATE UNIQUE INDEX "CreditTopUp_payment_intent_idx" ON "CreditTopUp" USING btree ("stripePaymentIntentId");
