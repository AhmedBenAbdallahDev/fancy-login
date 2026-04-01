import { z } from "zod";

// ============================================================================
// CHARACTER - Shareable AI characters/bots
// ============================================================================

export interface Character {
  id: string;
  userId: string;
  creatorUsername?: string; // @username of the creator
  name: string;
  tagline?: string;
  description?: string;
  avatar?: string;
  personality?: string;
  systemPrompt?: string;
  greeting?: string;
  exampleDialogue?: string;
  scenario?: string;
  postHistoryInstructions?: string;
  alternateGreetings?: string[];
  tags: string[];
  isPublic: boolean;
  isNSFW: boolean;
  chatCount: number;
  messageCount: number;
  likeCount: number;
  tokenCount?: number;
  allowedTools: string[];
  // External source tracking (for imported characters)
  externalSource?: string;
  externalId?: string;
  externalUrl?: string;
  externalCreator?: string;
  importedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// For displaying in lists (without heavy fields)
export interface CharacterSummary {
  id: string;
  userId: string;
  creatorUsername?: string; // @username of the creator
  name: string;
  tagline?: string;
  avatar?: string;
  tags: string[];
  isPublic: boolean;
  isNSFW: boolean;
  chatCount: number;
  messageCount: number;
  likeCount: number;
  tokenCount?: number;
  externalSource?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Comment on a character
export interface CharacterComment {
  id: string;
  characterId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export const CharacterCreateSchema = z.object({
  name: z.string().min(1).max(100),
  tagline: z.string().max(200).optional(),
  description: z.string().max(10000).optional(),
  avatar: z.string().optional(),
  personality: z.string().max(5000).optional(),
  systemPrompt: z.string().max(20000).optional(),
  greeting: z.string().max(5000).optional(),
  exampleDialogue: z.string().max(10000).optional(),
  scenario: z.string().max(5000).optional(),
  postHistoryInstructions: z.string().max(2000).optional(),
  alternateGreetings: z.array(z.string().max(5000)).max(10).optional(),
  tags: z.array(z.string().max(50)).max(20).optional().default([]),
  isPublic: z.boolean().optional().default(false),
  isNSFW: z.boolean().optional().default(false),
  tokenCount: z.number().optional(),
  allowedTools: z.array(z.string()).optional().default([]),
  creatorUsername: z.string().max(20).optional(), // Set automatically when publishing
  // External source fields (for imports)
  externalSource: z.string().optional(),
  externalId: z.string().optional(),
  externalUrl: z.string().optional(),
  externalCreator: z.string().optional(),
  originalData: z.record(z.unknown()).optional(),
});

export const CharacterUpdateSchema = CharacterCreateSchema.partial();

export type CharacterCreate = z.infer<typeof CharacterCreateSchema>;
export type CharacterUpdate = z.infer<typeof CharacterUpdateSchema>;

export const CharacterGenerateSchema = z.object({
  name: z.string().describe("Character name"),
  tagline: z.string().describe("Short catchy tagline"),
  description: z.string().describe("Character description/backstory"),
  personality: z.string().describe("Character personality traits"),
  systemPrompt: z.string().describe("Core instructions for the character"),
  greeting: z.string().describe("First message the character sends"),
  exampleDialogue: z
    .string()
    .describe("Example conversation to show speaking style"),
  tools: z
    .array(z.string())
    .describe("Allowed tools names")
    .optional()
    .default([]),
});

export interface CharacterRepository {
  // CRUD
  create(userId: string, data: CharacterCreate): Promise<Character>;
  findById(id: string): Promise<Character | null>;
  findByIdForUser(id: string, userId: string): Promise<Character | null>;
  findByUserId(userId: string): Promise<CharacterSummary[]>;
  update(id: string, userId: string, data: CharacterUpdate): Promise<Character>;
  delete(id: string, userId: string): Promise<void>;

  // Public characters
  findPublic(options?: {
    limit?: number;
    offset?: number;
    search?: string;
    tags?: string[];
    sortBy?: "popular" | "newest" | "name" | "likes";
    creatorUsername?: string;
  }): Promise<CharacterSummary[]>;
  findPublicById(id: string): Promise<Character | null>;

  // Stats
  incrementChatCount(id: string): Promise<void>;
  incrementMessageCount(id: string): Promise<void>;

  // Likes
  like(characterId: string, userId: string): Promise<void>;
  unlike(characterId: string, userId: string): Promise<void>;
  isLikedByUser(characterId: string, userId: string): Promise<boolean>;
  getLikedByUser(userId: string): Promise<CharacterSummary[]>;

  // Comments
  addComment(
    characterId: string,
    userId: string,
    userName: string,
    userAvatar: string | undefined,
    content: string,
  ): Promise<CharacterComment>;
  getComments(
    characterId: string,
    limit?: number,
    offset?: number,
  ): Promise<CharacterComment[]>;
  deleteComment(commentId: string, userId: string): Promise<void>;
}
