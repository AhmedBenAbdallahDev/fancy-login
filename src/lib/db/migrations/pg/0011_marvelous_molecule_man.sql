ALTER TABLE "chat_thread" ADD COLUMN "parent_thread_id" uuid;--> statement-breakpoint
ALTER TABLE "chat_thread" ADD COLUMN "branched_from_message_id" text;--> statement-breakpoint
ALTER TABLE "chat_thread" ADD CONSTRAINT "chat_thread_parent_thread_id_chat_thread_id_fk" FOREIGN KEY ("parent_thread_id") REFERENCES "public"."chat_thread"("id") ON DELETE set null ON UPDATE no action;