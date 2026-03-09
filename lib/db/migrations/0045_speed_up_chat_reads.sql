CREATE INDEX IF NOT EXISTS "Chat_user_id_updated_at_idx" ON "Chat" USING btree ("userId","updatedAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Chat_user_id_project_id_updated_at_idx" ON "Chat" USING btree ("userId","projectId","updatedAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Message_chat_id_created_at_idx" ON "Message" USING btree ("chatId","createdAt");
