CREATE TABLE "character_lorebook" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"name" text NOT NULL,
	"entries" json DEFAULT '[]'::json NOT NULL,
	"is_embedded" boolean DEFAULT false NOT NULL,
	"source_lorebook_id" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"bio" text,
	"avatar" text,
	"banner_image" text,
	"social_links" json,
	"is_verified" boolean DEFAULT false NOT NULL,
	"follower_count" integer DEFAULT 0 NOT NULL,
	"bot_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "creator_profile_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "creator_profile_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "user_character_bookmark" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"card_data" json NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "user_character_bookmark_user_id_source_external_id_unique" UNIQUE("user_id","source","external_id")
);
--> statement-breakpoint
CREATE TABLE "user_import_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"character_id" uuid,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"external_name" text NOT NULL,
	"import_type" text NOT NULL,
	"imported_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_tag_blocklist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"tag" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "character" ADD COLUMN "creator_username" text;--> statement-breakpoint
ALTER TABLE "character" ADD COLUMN "scenario" text;--> statement-breakpoint
ALTER TABLE "character" ADD COLUMN "post_history_instructions" text;--> statement-breakpoint
ALTER TABLE "character" ADD COLUMN "alternate_greetings" json DEFAULT '[]'::json;--> statement-breakpoint
ALTER TABLE "character" ADD COLUMN "token_count" integer;--> statement-breakpoint
ALTER TABLE "character" ADD COLUMN "external_source" text;--> statement-breakpoint
ALTER TABLE "character" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "character" ADD COLUMN "external_url" text;--> statement-breakpoint
ALTER TABLE "character" ADD COLUMN "external_creator" text;--> statement-breakpoint
ALTER TABLE "character" ADD COLUMN "imported_at" timestamp;--> statement-breakpoint
ALTER TABLE "character" ADD COLUMN "original_data" json;--> statement-breakpoint
ALTER TABLE "chat_message" ADD COLUMN "is_summary" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "chat_message" ADD COLUMN "summarized_message_ids" json;--> statement-breakpoint
ALTER TABLE "chat_message" ADD COLUMN "summarized_at" timestamp;--> statement-breakpoint
ALTER TABLE "character_lorebook" ADD CONSTRAINT "character_lorebook_character_id_character_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."character"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_import_history" ADD CONSTRAINT "user_import_history_character_id_character_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."character"("id") ON DELETE set null ON UPDATE no action;