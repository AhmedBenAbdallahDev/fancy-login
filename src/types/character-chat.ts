import { z } from "zod";
import { Agent } from "./agent";
import { Persona } from "./persona";

// ============================================================================
// CHARACTER CHAT - Conversations with characters (using Agent as character)
// ============================================================================

// Summary type for displaying in lists (lighter than full Agent)
export interface CharacterSummary {
  id: string;
  userId: string;
  name: string;
  tagline?: string;
  avatar?: string;
  icon?: Agent["icon"];
  isPublic?: boolean;
  chatCount?: number;
  likeCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CharacterChat {
  id: string;
  userId: string;
  title?: string;
  isGroupChat: boolean;
  primaryCharacterId?: string;
  personaId?: string;
  model?: string;
  temperature?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CharacterChatWithDetails extends CharacterChat {
  primaryCharacter?: CharacterSummary;
  persona?: Persona;
  participants?: CharacterChatParticipant[];
  lastMessage?: CharacterChatMessage;
  messageCount?: number;
}

export interface CharacterChatParticipant {
  id: string;
  chatId: string;
  characterId: string;
  turnOrder: number;
  isTemporary: boolean;
  addedAt: Date;
  // Populated when fetching
  character?: CharacterSummary;
}

export interface CharacterChatMessage {
  id: string;
  chatId: string;
  characterId?: string; // null = user message
  role: "user" | "assistant" | "system";
  content: string;
  model?: string;
  attachments?: any[];
  toolCalls?: any[];
  createdAt: Date;
  // Populated when fetching
  character?: CharacterSummary;
}

// ============================================================================
// SCHEMAS
// ============================================================================

export const CharacterChatCreateSchema = z.object({
  characterId: z.string().uuid(), // Primary character to chat with
  personaId: z.string().uuid().optional(),
  title: z.string().max(200).optional(),
  model: z.string().optional(),
});

export const GroupChatCreateSchema = z.object({
  characterIds: z.array(z.string().uuid()).min(2).max(10),
  personaId: z.string().uuid().optional(),
  title: z.string().max(200).optional(),
  model: z.string().optional(),
});

export const CharacterChatMessageCreateSchema = z.object({
  chatId: z.string().uuid(),
  content: z.string().min(1),
  attachments: z.array(z.any()).optional(),
});

export type CharacterChatCreate = z.infer<typeof CharacterChatCreateSchema>;
export type GroupChatCreate = z.infer<typeof GroupChatCreateSchema>;
export type CharacterChatMessageCreate = z.infer<
  typeof CharacterChatMessageCreateSchema
>;

// ============================================================================
// REPOSITORY INTERFACE
// ============================================================================

export interface CharacterChatRepository {
  // Chat CRUD
  createChat(userId: string, data: CharacterChatCreate): Promise<CharacterChat>;
  createGroupChat(
    userId: string,
    data: GroupChatCreate,
  ): Promise<CharacterChat>;
  findChatById(
    id: string,
    userId: string,
  ): Promise<CharacterChatWithDetails | null>;
  findChatsByUserId(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      characterId?: string;
    },
  ): Promise<CharacterChatWithDetails[]>;
  updateChat(
    id: string,
    userId: string,
    data: Partial<Pick<CharacterChat, "title" | "model" | "personaId">>,
  ): Promise<CharacterChat>;
  deleteChat(id: string, userId: string): Promise<void>;

  // Participants (for group chats)
  addParticipant(
    chatId: string,
    characterId: string,
    options?: {
      turnOrder?: number;
      isTemporary?: boolean;
    },
  ): Promise<CharacterChatParticipant>;
  removeParticipant(chatId: string, characterId: string): Promise<void>;
  getParticipants(chatId: string): Promise<CharacterChatParticipant[]>;

  // Messages
  addMessage(data: {
    chatId: string;
    characterId?: string;
    role: "user" | "assistant" | "system";
    content: string;
    model?: string;
    attachments?: any[];
    toolCalls?: any[];
  }): Promise<CharacterChatMessage>;
  getMessages(
    chatId: string,
    options?: {
      limit?: number;
      before?: string; // message id for pagination
    },
  ): Promise<CharacterChatMessage[]>;
  deleteMessage(id: string, chatId: string): Promise<void>;

  // Utilities
  getChatContext(chatId: string): Promise<{
    chat: CharacterChatWithDetails;
    characters: Agent[];
    persona?: Persona;
    recentMessages: CharacterChatMessage[];
  } | null>;
}
