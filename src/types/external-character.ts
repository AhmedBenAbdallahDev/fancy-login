import { z } from "zod";

// ============================================================================
// EXTERNAL CHARACTER SOURCES
// Normalized types for importing characters from JannyAI, Chub, Wyvern, etc.
// ============================================================================

export type ExternalSourceSlug =
  | "jannyai"
  | "chub"
  | "wyvern"
  | "character_tavern"
  | "backyard"
  | "pygmalion"
  | "risuai"
  | "catbox"
  | "all";

export interface ExternalSource {
  slug: ExternalSourceSlug;
  name: string;
  baseUrl: string;
  iconUrl?: string;
  description?: string;
  supportsTrending: boolean;
  supportsSearch: boolean;
  supportsLorebooks: boolean;
  supportsCollections: boolean;
  requiresCorsProxy: boolean;
}

// All supported external sources
export const EXTERNAL_SOURCES: ExternalSource[] = [
  {
    slug: "jannyai",
    name: "JannyAI",
    baseUrl: "https://jannyai.com",
    iconUrl: "/icons/sources/jannyai.png",
    description: "High quality AI characters with detailed definitions",
    supportsTrending: true,
    supportsSearch: true,
    supportsLorebooks: false,
    supportsCollections: true,
    requiresCorsProxy: true,
  },
  {
    slug: "chub",
    name: "Chub.ai",
    baseUrl: "https://chub.ai",
    iconUrl: "/icons/sources/chub.png",
    description: "Large character library with lorebooks",
    supportsTrending: true,
    supportsSearch: true,
    supportsLorebooks: true,
    supportsCollections: false,
    requiresCorsProxy: false,
  },
  {
    slug: "wyvern",
    name: "Wyvern Chat",
    baseUrl: "https://wyvern.chat",
    iconUrl: "/icons/sources/wyvern.png",
    description: "Characters and lorebooks",
    supportsTrending: true,
    supportsSearch: true,
    supportsLorebooks: true,
    supportsCollections: false,
    requiresCorsProxy: true,
  },
  {
    slug: "character_tavern",
    name: "Character Tavern",
    baseUrl: "https://character-tavern.com",
    iconUrl: "/icons/sources/character-tavern.png",
    description: "Community character sharing",
    supportsTrending: true,
    supportsSearch: true,
    supportsLorebooks: true,
    supportsCollections: false,
    requiresCorsProxy: true,
  },
  {
    slug: "backyard",
    name: "Backyard.ai",
    baseUrl: "https://backyard.ai",
    iconUrl: "/icons/sources/backyard.png",
    description: "AI character platform",
    supportsTrending: true,
    supportsSearch: true,
    supportsLorebooks: false,
    supportsCollections: false,
    requiresCorsProxy: true,
  },
  {
    slug: "pygmalion",
    name: "Pygmalion.chat",
    baseUrl: "https://pygmalion.chat",
    iconUrl: "/icons/sources/pygmalion.png",
    description: "Open source AI chat characters",
    supportsTrending: true,
    supportsSearch: true,
    supportsLorebooks: false,
    supportsCollections: false,
    requiresCorsProxy: true,
  },
  {
    slug: "risuai",
    name: "RisuAI Realm",
    baseUrl: "https://realm.risuai.net",
    iconUrl: "/icons/sources/risuai.png",
    description: "RisuAI character sharing",
    supportsTrending: true,
    supportsSearch: true,
    supportsLorebooks: false,
    supportsCollections: false,
    requiresCorsProxy: true,
  },
];

// ============================================================================
// EXTERNAL CHARACTER CARD - Normalized format for all sources
// ============================================================================

export interface ExternalCharacterCard {
  // Identity
  id: string;
  source: ExternalSourceSlug;
  sourceUrl: string;

  // Basic info
  name: string;
  creator?: string;
  avatarUrl?: string;

  // Tags
  tags: string[];

  // Descriptions
  tagline?: string; // Short one-liner (website description)
  description?: string; // Full character description/backstory

  // Character definition fields (normalized from various source formats)
  personality?: string; // Personality traits/description
  scenario?: string; // Scenario/setting
  firstMessage?: string; // First greeting
  exampleDialogue?: string; // Example conversation
  systemPrompt?: string; // System prompt/instructions
  postHistoryInstructions?: string; // Instructions after chat history
  alternateGreetings?: string[]; // Alternative first messages

  // Lorebook
  characterBook?: CharacterBook;

  // Metadata
  isNsfw: boolean;
  tokenCount?: number;
  chatCount?: number;
  messageCount?: number;
  downloadCount?: number;
  likeCount?: number;
  viewCount?: number;
  creatorNotes?: string;
  createdAt?: Date;

  // Raw data for reference
  rawData?: Record<string, unknown>;
}

// ============================================================================
// LOREBOOK / CHARACTER BOOK
// ============================================================================

export interface CharacterBook {
  name?: string;
  description?: string;
  entries: LorebookEntry[];
}

export interface LorebookEntry {
  id: number;
  keys: string[];
  secondaryKeys?: string[];
  content: string;
  name?: string;
  comment?: string;
  enabled: boolean;
  insertionOrder: number;
  priority?: number;
  position?: "before_char" | "after_char";
  constant?: boolean;
  selective?: boolean;
  selectiveLogic?: number;
  probability?: number;
  useProbability?: boolean;
  depth?: number;
  group?: string;
  caseSensitive?: boolean;
  matchWholeWords?: boolean;
}

// ============================================================================
// SEARCH OPTIONS & RESULTS
// ============================================================================

export interface ExternalSearchOptions {
  query?: string;
  page?: number;
  limit?: number;
  sort?: "newest" | "popular" | "relevance" | "trending";
  tags?: string[];
  excludeTags?: string[];
  nsfw?: boolean;
  minTokens?: number;
  maxTokens?: number;
}

export interface ExternalSearchResult {
  cards: ExternalCharacterCard[];
  totalHits: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
  source: ExternalSourceSlug;
}

// ============================================================================
// JANNYAI SPECIFIC - Tag ID mapping
// ============================================================================

export const JANNYAI_TAGS: Record<number, string> = {
  1: "Male",
  2: "Female",
  3: "Non-binary",
  4: "Celebrity",
  5: "OC",
  6: "Fictional",
  7: "Real",
  8: "Game",
  9: "Anime",
  10: "Historical",
  11: "Royalty",
  12: "Detective",
  13: "Hero",
  14: "Villain",
  15: "Magical",
  16: "Non-human",
  17: "Monster",
  18: "Monster Girl",
  19: "Alien",
  20: "Robot",
  21: "Politics",
  22: "Vampire",
  23: "Giant",
  24: "OpenAI",
  25: "Elf",
  26: "Multiple",
  27: "VTuber",
  28: "Dominant",
  29: "Submissive",
  30: "Scenario",
  31: "Pokemon",
  32: "Assistant",
  34: "Non-English",
  36: "Philosophy",
  38: "RPG",
  39: "Religion",
  41: "Books",
  42: "AnyPOV",
  43: "Angst",
  44: "Demi-Human",
  45: "Enemies to Lovers",
  46: "Smut",
  47: "MLM",
  48: "WLW",
  49: "Action",
  50: "Romance",
  51: "Horror",
  52: "Slice of Life",
  53: "Fantasy",
  54: "Drama",
  55: "Comedy",
  56: "Mystery",
  57: "Sci-Fi",
  59: "Yandere",
  60: "Furry",
  61: "Movies/TV",
};

// Reverse mapping for filtering by tag name
export const JANNYAI_TAG_IDS: Record<string, number> = Object.fromEntries(
  Object.entries(JANNYAI_TAGS).map(([id, name]) => [
    name.toLowerCase(),
    parseInt(id),
  ]),
);

// ============================================================================
// COLLECTIONS (JannyAI)
// ============================================================================

export interface ExternalCollection {
  id: string;
  slug: string;
  name: string;
  description?: string;
  characterCount: number;
  lastUpdated?: string;
  creator: {
    username: string;
    name: string;
    avatar?: string;
  };
  views?: number;
  previewImages: string[];
  url: string;
}

export interface ExternalCollectionResult {
  collections: ExternalCollection[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalEntries: number;
    hasMore: boolean;
  };
}

// ============================================================================
// IMPORT DATA - What we save when importing
// ============================================================================

export interface ImportCharacterData {
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
  isNSFW: boolean;
  tokenCount?: number;
  externalSource: ExternalSourceSlug;
  externalId: string;
  externalUrl: string;
  externalCreator?: string;
  originalData?: Record<string, unknown>;
  characterBook?: CharacterBook;
}

// ============================================================================
// ZOD SCHEMAS FOR VALIDATION
// ============================================================================

export const ExternalSearchOptionsSchema = z.object({
  query: z.string().optional(),
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().max(100).optional().default(40),
  sort: z
    .enum(["newest", "popular", "relevance", "trending"])
    .optional()
    .default("popular"),
  tags: z.array(z.string()).optional(),
  excludeTags: z.array(z.string()).optional(),
  nsfw: z.boolean().optional().default(true),
  minTokens: z.number().int().positive().optional(),
  maxTokens: z.number().int().positive().optional(),
});

export const ImportCharacterSchema = z.object({
  source: z.enum([
    "jannyai",
    "chub",
    "wyvern",
    "character_tavern",
    "backyard",
    "pygmalion",
    "risuai",
    "catbox",
  ]),
  externalId: z.string().min(1),
  // Optional overrides
  name: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional().default(false),
});
