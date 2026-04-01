-- Full schema migration for Anvil Chat
-- This creates all tables from scratch for a new database

-- ============================================================================
-- USER & AUTH TABLES (Better Auth)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "user" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "email_verified" BOOLEAN DEFAULT false NOT NULL,
  "password" TEXT,
  "image" TEXT,
  "preferences" JSONB DEFAULT '{}',
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "expires_at" TIMESTAMP NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "created_at" TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP NOT NULL,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "user_id" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "account" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "user_id" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "access_token" TEXT,
  "refresh_token" TEXT,
  "id_token" TEXT,
  "access_token_expires_at" TIMESTAMP,
  "refresh_token_expires_at" TIMESTAMP,
  "scope" TEXT,
  "password" TEXT,
  "created_at" TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expires_at" TIMESTAMP NOT NULL,
  "created_at" TIMESTAMP,
  "updated_at" TIMESTAMP
);

-- ============================================================================
-- PERSONA SYSTEM - User's own identity/avatar for chatting
-- ============================================================================

CREATE TABLE IF NOT EXISTS "persona" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "avatar" TEXT,
  "is_default" BOOLEAN DEFAULT false NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS "persona_user_id_idx" ON "persona"("user_id");

-- ============================================================================
-- CHARACTER SYSTEM - Shareable AI characters/bots
-- ============================================================================

CREATE TABLE IF NOT EXISTS "character" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "tagline" TEXT,
  "description" TEXT,
  "avatar" TEXT,
  "personality" TEXT,
  "system_prompt" TEXT,
  "greeting" TEXT,
  "example_dialogue" TEXT,
  "tags" JSONB DEFAULT '[]',
  "is_public" BOOLEAN DEFAULT false NOT NULL,
  "is_nsfw" BOOLEAN DEFAULT false NOT NULL,
  "chat_count" INTEGER DEFAULT 0 NOT NULL,
  "like_count" INTEGER DEFAULT 0 NOT NULL,
  "allowed_tools" JSONB DEFAULT '[]',
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS "character_user_id_idx" ON "character"("user_id");
CREATE INDEX IF NOT EXISTS "character_is_public_idx" ON "character"("is_public");
CREATE INDEX IF NOT EXISTS "character_chat_count_idx" ON "character"("chat_count" DESC);

-- ============================================================================
-- CHARACTER CHAT SYSTEM - Conversations with characters
-- ============================================================================

CREATE TABLE IF NOT EXISTS "character_chat" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" TEXT NOT NULL,
  "title" TEXT,
  "is_group_chat" BOOLEAN DEFAULT false NOT NULL,
  "primary_character_id" UUID REFERENCES "character"("id") ON DELETE SET NULL,
  "persona_id" UUID REFERENCES "persona"("id") ON DELETE SET NULL,
  "model" TEXT,
  "temperature" TEXT,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS "character_chat_user_id_idx" ON "character_chat"("user_id");

-- For group chats - links multiple characters to a chat
CREATE TABLE IF NOT EXISTS "character_chat_participant" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "chat_id" UUID NOT NULL REFERENCES "character_chat"("id") ON DELETE CASCADE,
  "character_id" UUID NOT NULL REFERENCES "character"("id") ON DELETE CASCADE,
  "turn_order" INTEGER DEFAULT 0 NOT NULL,
  "is_temporary" BOOLEAN DEFAULT false NOT NULL,
  "added_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE("chat_id", "character_id")
);

-- Messages in character chats
CREATE TABLE IF NOT EXISTS "character_chat_message" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "chat_id" UUID NOT NULL REFERENCES "character_chat"("id") ON DELETE CASCADE,
  "character_id" UUID REFERENCES "character"("id") ON DELETE SET NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "model" TEXT,
  "attachments" JSONB,
  "tool_calls" JSONB,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS "character_chat_message_chat_id_idx" ON "character_chat_message"("chat_id");

-- User likes on characters
CREATE TABLE IF NOT EXISTS "character_like" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "character_id" UUID NOT NULL REFERENCES "character"("id") ON DELETE CASCADE,
  "user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE("character_id", "user_id")
);

-- ============================================================================
-- LEGACY AGENT SYSTEM (keeping for backward compatibility)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "agent" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "icon" JSONB,
  "user_id" TEXT NOT NULL,
  "is_public" BOOLEAN DEFAULT false NOT NULL,
  "instructions" JSONB,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS "agent_user_id_idx" ON "agent"("user_id");
CREATE INDEX IF NOT EXISTS "agent_is_public_idx" ON "agent"("is_public");

-- ============================================================================
-- MCP SERVER SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS "mcp_server" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" TEXT NOT NULL,
  "config" JSONB NOT NULL,
  "enabled" BOOLEAN DEFAULT true NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "mcp_server_tool_custom_instructions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "tool_name" TEXT NOT NULL,
  "mcp_server_id" UUID NOT NULL REFERENCES "mcp_server"("id") ON DELETE CASCADE,
  "prompt" TEXT,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE("user_id", "tool_name", "mcp_server_id")
);

CREATE TABLE IF NOT EXISTS "mcp_server_custom_instructions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "mcp_server_id" UUID NOT NULL REFERENCES "mcp_server"("id") ON DELETE CASCADE,
  "prompt" TEXT,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE("user_id", "mcp_server_id")
);

-- ============================================================================
-- WORKFLOW SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS "workflow" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "version" TEXT DEFAULT '0.1.0' NOT NULL,
  "name" TEXT NOT NULL,
  "icon" JSONB,
  "description" TEXT,
  "is_published" BOOLEAN DEFAULT false NOT NULL,
  "visibility" VARCHAR(20) DEFAULT 'private' NOT NULL,
  "user_id" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "workflow_node" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "version" TEXT DEFAULT '0.1.0' NOT NULL,
  "workflow_id" UUID NOT NULL REFERENCES "workflow"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "ui_config" JSONB DEFAULT '{}',
  "node_config" JSONB DEFAULT '{}',
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS "workflow_node_kind_idx" ON "workflow_node"("kind");

CREATE TABLE IF NOT EXISTS "workflow_edge" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "version" TEXT DEFAULT '0.1.0' NOT NULL,
  "workflow_id" UUID NOT NULL REFERENCES "workflow"("id") ON DELETE CASCADE,
  "source" UUID NOT NULL REFERENCES "workflow_node"("id") ON DELETE CASCADE,
  "target" UUID NOT NULL REFERENCES "workflow_node"("id") ON DELETE CASCADE,
  "ui_config" JSONB DEFAULT '{}',
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ============================================================================
-- ARCHIVE SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS "archive" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "user_id" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "archive_item" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "archive_id" UUID NOT NULL REFERENCES "archive"("id") ON DELETE CASCADE,
  "item_id" UUID NOT NULL,
  "user_id" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "added_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS "archive_item_item_id_idx" ON "archive_item"("item_id");

-- ============================================================================
-- LEGACY CHAT SYSTEM (keeping for backward compatibility with GitHub-stored chats)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "chat_thread" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" TEXT NOT NULL,
  "user_id" UUID NOT NULL REFERENCES "user"("id"),
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "chat_message" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "thread_id" UUID NOT NULL REFERENCES "chat_thread"("id"),
  "role" TEXT NOT NULL,
  "parts" JSONB[] NOT NULL,
  "attachments" JSONB[],
  "annotations" JSONB[],
  "model" TEXT,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
