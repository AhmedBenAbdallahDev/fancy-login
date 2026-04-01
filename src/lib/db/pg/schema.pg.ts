import { ChatMessage } from "app-types/chat";
import { Agent } from "app-types/agent";
import { UserPreferences } from "app-types/user";
import { MCPServerConfig } from "app-types/mcp";
import { LorebookEntry } from "app-types/external-character";
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  json,
  uuid,
  boolean,
  unique,
  varchar,
  index,
  integer,
} from "drizzle-orm/pg-core";
import { DBWorkflow, DBEdge, DBNode } from "app-types/workflow";

export const ChatThreadSchema = pgTable("chat_thread", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  title: text("title").notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => UserSchema.id),
  // Character/Roleplay mode fields - references separate character table
  characterId: uuid("character_id").references(() => CharacterSchema.id, {
    onDelete: "set null",
  }),
  personaId: uuid("persona_id").references(() => PersonaSchema.id, {
    onDelete: "set null",
  }),
  stylePresetId: uuid("style_preset_id").references(
    () => StylePresetSchema.id,
    { onDelete: "set null" },
  ),
  // Branching fields
  parentThreadId: uuid("parent_thread_id").references((): any => ChatThreadSchema.id, {
    onDelete: "set null",
  }),
  branchedFromMessageId: text("branched_from_message_id"),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const ChatMessageSchema = pgTable("chat_message", {
  id: text("id").primaryKey().notNull(),
  threadId: uuid("thread_id")
    .notNull()
    .references(() => ChatThreadSchema.id),
  role: text("role").notNull().$type<ChatMessage["role"]>(),
  parts: json("parts").notNull().array(),
  attachments: json("attachments").array(),
  annotations: json("annotations").array(),
  model: text("model"),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  // Summary fields (for context compression)
  isSummary: boolean("is_summary").default(false),
  summarizedMessageIds: json("summarized_message_ids").$type<string[]>(),
  summarizedAt: timestamp("summarized_at"),
});

export const AgentSchema = pgTable("agent", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: text("name").notNull(),
  tagline: text("tagline"),
  description: text("description"),
  avatar: text("avatar"),
  icon: json("icon").$type<Agent["icon"]>(),
  // userId is TEXT to support both PostgreSQL UUIDs and GitHub numeric IDs
  // No foreign key - agents can be created by GitHub-authenticated users who don't have a user table entry
  userId: text("user_id").notNull(),
  isPublic: boolean("is_public").notNull().default(false),
  instructions: json("instructions").$type<Agent["instructions"]>(),
  // Stats
  chatCount: integer("chat_count").notNull().default(0),
  likeCount: integer("like_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ============================================================================
// PERSONA SYSTEM - User's own identity/avatar for chatting
// ============================================================================

export const PersonaSchema = pgTable("persona", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  // userId is TEXT to support both PostgreSQL UUIDs and GitHub numeric IDs
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  avatar: text("avatar"), // URL or base64 image
  personality: text("personality"), // User's character traits
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ============================================================================
// STYLE PRESET SYSTEM - Global writing styles for chats
// ============================================================================

export const StylePresetSchema = pgTable("style_preset", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  // userId is TEXT to support both PostgreSQL UUIDs and GitHub numeric IDs
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  systemPrompt: text("system_prompt").notNull(), // The style rules
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ============================================================================
// CHARACTER SYSTEM - Shareable AI characters/bots (enhanced agents)
// ============================================================================

export const CharacterSchema = pgTable("character", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  // userId is TEXT to support both PostgreSQL UUIDs and GitHub numeric IDs
  userId: text("user_id").notNull(),
  // Creator username for display (denormalized from creator_profile)
  creatorUsername: text("creator_username"),
  name: text("name").notNull(),
  tagline: text("tagline"), // Short one-liner description
  description: text("description"), // Full description/backstory
  avatar: text("avatar"), // URL or base64 image
  personality: text("personality"), // Personality traits
  systemPrompt: text("system_prompt"), // The actual AI instructions
  greeting: text("greeting"), // First message when starting a chat
  exampleDialogue: text("example_dialogue"), // Example conversation for AI context
  scenario: text("scenario"), // Scenario/setting for the character
  postHistoryInstructions: text("post_history_instructions"), // Instructions after chat history
  alternateGreetings: json("alternate_greetings").$type<string[]>().default([]),
  tags: json("tags").$type<string[]>().default([]),
  isPublic: boolean("is_public").notNull().default(false),
  isNSFW: boolean("is_nsfw").notNull().default(false),
  chatCount: integer("chat_count").notNull().default(0), // Popularity metric
  messageCount: integer("message_count").notNull().default(0), // Total messages sent to this character
  likeCount: integer("like_count").notNull().default(0),
  tokenCount: integer("token_count"), // Total tokens in character definition
  // Tool/MCP access for the character
  allowedTools: json("allowed_tools").$type<string[]>().default([]),
  // External source tracking (for imported characters)
  externalSource: text("external_source"), // 'jannyai', 'chub', 'wyvern', etc.
  externalId: text("external_id"), // Original ID from source
  externalUrl: text("external_url"), // Link to original
  externalCreator: text("external_creator"), // Creator on original platform
  importedAt: timestamp("imported_at"), // When imported
  originalData: json("original_data"), // Full original card data for reference
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// User likes on characters
export const CharacterLikeSchema = pgTable(
  "character_like",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    characterId: uuid("character_id")
      .notNull()
      .references(() => CharacterSchema.id, { onDelete: "cascade" }),
    // userId is TEXT to support both PostgreSQL UUIDs and GitHub numeric IDs
    userId: text("user_id").notNull(),
    createdAt: timestamp("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [unique().on(table.characterId, table.userId)],
);

// Comments on public characters
export const CharacterCommentSchema = pgTable("character_comment", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  characterId: uuid("character_id")
    .notNull()
    .references(() => CharacterSchema.id, { onDelete: "cascade" }),
  // userId is TEXT to support both PostgreSQL UUIDs and GitHub numeric IDs
  userId: text("user_id").notNull(),
  userName: text("user_name").notNull(),
  userAvatar: text("user_avatar"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ============================================================================
// CHARACTER LOREBOOK - World info/lorebook entries for characters
// ============================================================================

export const CharacterLorebookSchema = pgTable("character_lorebook", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  characterId: uuid("character_id")
    .notNull()
    .references(() => CharacterSchema.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  entries: json("entries").$type<LorebookEntry[]>().notNull().default([]),
  isEmbedded: boolean("is_embedded").notNull().default(false), // Embedded vs linked
  sourceLorebookId: text("source_lorebook_id"), // If imported from external source
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ============================================================================
// USER EXTERNAL CHARACTER BOOKMARKS - Bookmarks before import
// ============================================================================

export const UserCharacterBookmarkSchema = pgTable(
  "user_character_bookmark",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: text("user_id").notNull(),
    source: text("source").notNull(), // 'jannyai', 'chub', etc.
    externalId: text("external_id").notNull(),
    cardData: json("card_data").notNull(), // Cached card data for display
    createdAt: timestamp("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [unique().on(table.userId, table.source, table.externalId)],
);

// ============================================================================
// USER TAG BLOCKLIST - Tags user wants to filter out
// ============================================================================

export const UserTagBlocklistSchema = pgTable("user_tag_blocklist", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: text("user_id").notNull(),
  tag: text("tag").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ============================================================================
// USER IMPORT HISTORY - Track character imports
// ============================================================================

export const UserImportHistorySchema = pgTable("user_import_history", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: text("user_id").notNull(),
  characterId: uuid("character_id").references(() => CharacterSchema.id, {
    onDelete: "set null",
  }),
  source: text("source").notNull(),
  externalId: text("external_id").notNull(),
  externalName: text("external_name").notNull(),
  importType: text("import_type").notNull(), // 'character', 'lorebook'
  importedAt: timestamp("imported_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const McpServerSchema = pgTable("mcp_server", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: text("name").notNull(),
  config: json("config").notNull().$type<MCPServerConfig>(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const UserSchema = pgTable("user", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  password: text("password"),
  image: text("image"),
  preferences: json("preferences").default({}).$type<UserPreferences>(),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// ============================================================================
// CREATOR PROFILE - Public identity for publishing bots & commenting
// ============================================================================

export const CreatorProfileSchema = pgTable("creator_profile", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  // Links to any user - can be UUID (PostgreSQL user) or numeric string (GitHub user)
  userId: text("user_id").notNull().unique(),
  // @username - unique, stored lowercase for case-insensitive lookup
  username: text("username").notNull().unique(),
  // Display name shown on profile
  displayName: text("display_name").notNull(),
  // Long bio/description (up to 2000 chars)
  bio: text("bio"),
  // Profile avatar URL
  avatar: text("avatar"),
  // Profile banner image URL
  bannerImage: text("banner_image"),
  // Social links (JSON)
  socialLinks: json("social_links").$type<{
    twitter?: string;
    discord?: string;
    website?: string;
  }>(),
  // Verification status
  isVerified: boolean("is_verified").notNull().default(false),
  // Stats
  followerCount: integer("follower_count").notNull().default(0),
  botCount: integer("bot_count").notNull().default(0),
  // Timestamps
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const SessionSchema = pgTable("session", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: uuid("user_id")
    .notNull()
    .references(() => UserSchema.id, { onDelete: "cascade" }),
});

export const AccountSchema = pgTable("account", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => UserSchema.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const VerificationSchema = pgTable("verification", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").$defaultFn(
    () => /* @__PURE__ */ new Date(),
  ),
  updatedAt: timestamp("updated_at").$defaultFn(
    () => /* @__PURE__ */ new Date(),
  ),
});

// Tool customization table for per-user additional AI instructions
export const McpToolCustomizationSchema = pgTable(
  "mcp_server_tool_custom_instructions",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => UserSchema.id, { onDelete: "cascade" }),
    toolName: text("tool_name").notNull(),
    mcpServerId: uuid("mcp_server_id")
      .notNull()
      .references(() => McpServerSchema.id, { onDelete: "cascade" }),
    prompt: text("prompt"),
    createdAt: timestamp("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [unique().on(table.userId, table.toolName, table.mcpServerId)],
);

export const McpServerCustomizationSchema = pgTable(
  "mcp_server_custom_instructions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => UserSchema.id, { onDelete: "cascade" }),
    mcpServerId: uuid("mcp_server_id")
      .notNull()
      .references(() => McpServerSchema.id, { onDelete: "cascade" }),
    prompt: text("prompt"),
    createdAt: timestamp("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [unique().on(table.userId, table.mcpServerId)],
);

export const WorkflowSchema = pgTable("workflow", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  version: text("version").notNull().default("0.1.0"),
  name: text("name").notNull(),
  icon: json("icon").$type<DBWorkflow["icon"]>(),
  description: text("description"),
  isPublished: boolean("is_published").notNull().default(false),
  visibility: varchar("visibility", {
    enum: ["public", "private", "readonly"],
  })
    .notNull()
    .default("private"),
  userId: uuid("user_id")
    .notNull()
    .references(() => UserSchema.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const WorkflowNodeDataSchema = pgTable(
  "workflow_node",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    version: text("version").notNull().default("0.1.0"),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => WorkflowSchema.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    uiConfig: json("ui_config").$type<DBNode["uiConfig"]>().default({}),
    nodeConfig: json("node_config")
      .$type<Partial<DBNode["nodeConfig"]>>()
      .default({}),
    createdAt: timestamp("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [index("workflow_node_kind_idx").on(t.kind)],
);

export const WorkflowEdgeSchema = pgTable("workflow_edge", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  version: text("version").notNull().default("0.1.0"),
  workflowId: uuid("workflow_id")
    .notNull()
    .references(() => WorkflowSchema.id, { onDelete: "cascade" }),
  source: uuid("source")
    .notNull()
    .references(() => WorkflowNodeDataSchema.id, { onDelete: "cascade" }),
  target: uuid("target")
    .notNull()
    .references(() => WorkflowNodeDataSchema.id, { onDelete: "cascade" }),
  uiConfig: json("ui_config").$type<DBEdge["uiConfig"]>().default({}),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const ArchiveSchema = pgTable("archive", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  userId: uuid("user_id")
    .notNull()
    .references(() => UserSchema.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const ArchiveItemSchema = pgTable(
  "archive_item",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    archiveId: uuid("archive_id")
      .notNull()
      .references(() => ArchiveSchema.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => UserSchema.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [index("archive_item_item_id_idx").on(t.itemId)],
);

export type McpServerEntity = typeof McpServerSchema.$inferSelect;
export type ChatThreadEntity = typeof ChatThreadSchema.$inferSelect;
export type ChatMessageEntity = typeof ChatMessageSchema.$inferSelect;

export type AgentEntity = typeof AgentSchema.$inferSelect;
export type UserEntity = typeof UserSchema.$inferSelect;
export type ToolCustomizationEntity =
  typeof McpToolCustomizationSchema.$inferSelect;
export type McpServerCustomizationEntity =
  typeof McpServerCustomizationSchema.$inferSelect;

export type ArchiveEntity = typeof ArchiveSchema.$inferSelect;
export type ArchiveItemEntity = typeof ArchiveItemSchema.$inferSelect;

// Character System Types
export type PersonaEntity = typeof PersonaSchema.$inferSelect;
export type CharacterEntity = typeof CharacterSchema.$inferSelect;
export type CharacterLikeEntity = typeof CharacterLikeSchema.$inferSelect;
export type CreatorProfileEntity = typeof CreatorProfileSchema.$inferSelect;

// External Character System Types
export type CharacterLorebookEntity =
  typeof CharacterLorebookSchema.$inferSelect;
export type UserCharacterBookmarkEntity =
  typeof UserCharacterBookmarkSchema.$inferSelect;
export type UserTagBlocklistEntity = typeof UserTagBlocklistSchema.$inferSelect;
export type UserImportHistoryEntity =
  typeof UserImportHistorySchema.$inferSelect;
