/**
 * Wyvern Chat External Character Source
 * REST API with lorebook support
 */

import type {
  ExternalCharacterCard,
  ExternalSearchOptions,
  ExternalSearchResult,
  CharacterBook,
  LorebookEntry,
} from "app-types/external-character";
import type { ExternalCharacterSource } from "../base-source";
import { proxiedFetch } from "../cors-proxy";

// API endpoints
const WYVERN_API_BASE = "https://api.wyvern.chat/exploreSearch";
const WYVERN_BASE_URL = "https://wyvern.chat";

/**
 * Transform Wyvern API result to normalized card format
 * Based on actual Wyvern API response fields
 */
function transformWyvernCard(char: any): ExternalCharacterCard {
  // Creator info - nested in creator object
  const creatorName =
    char.creator?.displayName || char.creator?.vanityUrl || "Unknown";

  // NSFW status from rating field
  const isNsfw = char.rating === "mature" || char.rating === "explicit";

  // Tags - Wyvern stores as space-separated string
  const tags =
    typeof char.tags === "string"
      ? char.tags.split(/\s+/).filter(Boolean)
      : char.tags || [];

  // Stats from statistics_record or entity_statistics
  const stats = char.statistics_record || char.entity_statistics || {};

  return {
    id: char.id || char._id,
    source: "wyvern",
    sourceUrl: `${WYVERN_BASE_URL}/characters/${char.id || char._id}`,
    name: char.name || char.chat_name || "Unnamed",
    creator: creatorName,
    avatarUrl: char.avatar || "",
    tags,
    tagline: char.tagline || char.creator_notes?.substring(0, 200) || "",
    description: char.description || "",
    personality: char.personality || "",
    scenario: char.scenario || "",
    firstMessage: char.first_mes || "",
    exampleDialogue: char.mes_example || "",
    systemPrompt: char.pre_history_instructions || "",
    postHistoryInstructions: char.post_history_instructions || "",
    alternateGreetings:
      typeof char.alternate_greetings === "string"
        ? [] // Sometimes empty string
        : char.alternate_greetings || [],
    creatorNotes: char.creator_notes || char.shared_info || "",
    isNsfw,
    tokenCount: 0, // Not provided in API
    chatCount: stats.messages || 0,
    messageCount: stats.messages || 0,
    likeCount: stats.likes || 0,
    viewCount: stats.views || 0,
    createdAt: char.created_at ? new Date(char.created_at) : undefined,
    rawData: char,
  };
}

/**
 * Transform Wyvern lorebook to our format
 */
function transformWyvernLorebook(lorebook: any): CharacterBook | undefined {
  if (!lorebook?.entries?.length) return undefined;

  const entries: LorebookEntry[] = lorebook.entries.map(
    (entry: any, index: number) => ({
      id: entry.id || index,
      keys: entry.keys || entry.keywords || [],
      secondaryKeys: entry.secondary_keys || [],
      content: entry.content || "",
      name: entry.name || entry.comment || `Entry ${index + 1}`,
      comment: entry.comment || "",
      enabled: entry.enabled !== false,
      insertionOrder: entry.order || entry.insertion_order || 100,
      priority: entry.priority || 10,
      position: entry.position || "before_char",
      constant: entry.constant || false,
      selective: entry.selective || true,
      selectiveLogic: entry.selective_logic || 0,
      probability: entry.probability || 100,
      useProbability: entry.use_probability || true,
      depth: entry.depth || 4,
      group: entry.group || "",
      caseSensitive: entry.case_sensitive || false,
      matchWholeWords: entry.match_whole_words || false,
    }),
  );

  return {
    name: lorebook.name || "Lorebook",
    description: lorebook.description || "",
    entries,
  };
}

/**
 * Wyvern External Character Source Implementation
 */
export const wyvernSource: ExternalCharacterSource = {
  slug: "wyvern",
  name: "Wyvern Chat",

  async search(options: ExternalSearchOptions): Promise<ExternalSearchResult> {
    const {
      query = "",
      page = 1,
      limit = 40,
      sort = "popular",
      tags = [],
      nsfw = true,
    } = options;

    // Map sort to Wyvern format: votes, created_at, popular, nsfw-popular, name
    const sortMap: Record<string, string> = {
      popular: "votes",
      newest: "created_at",
      trending: "popular",
      relevance: "votes",
    };

    const params = new URLSearchParams();
    if (query) params.set("q", query);
    params.set("page", String(page));
    params.set("limit", String(limit));
    params.set("sort", sortMap[sort] || "votes");
    params.set("order", "DESC");

    if (tags.length > 0) {
      params.set("tags", tags.join(","));
    }

    // Rating filter for NSFW
    if (!nsfw) {
      params.set("rating", "none");
    }

    const response = await proxiedFetch(
      `${WYVERN_API_BASE}/characters?${params}`,
      {
        service: "wyvern",
        fetchOptions: {
          headers: { Accept: "application/json" },
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Wyvern search error ${response.status}`);
    }

    const data = await response.json();

    // Wyvern API returns: { results: [...], total, unfilteredCount, page, totalPages, hasMore }
    const characters = data.results || [];

    return {
      cards: characters.map(transformWyvernCard),
      totalHits: data.total || data.unfilteredCount || characters.length,
      page: data.page || page,
      totalPages:
        data.totalPages || Math.ceil((data.total || characters.length) / limit),
      hasMore: data.hasMore ?? characters.length >= limit,
      source: "wyvern",
    };
  },

  async getCharacter(id: string): Promise<ExternalCharacterCard> {
    // Wyvern uses different endpoint for individual characters
    const response = await proxiedFetch(
      `https://api.wyvern.chat/characters/${id}`,
      {
        service: "wyvern",
        fetchOptions: {
          headers: { Accept: "application/json" },
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch Wyvern character: ${response.status}`);
    }

    const data = await response.json();
    const char = data.character || data;
    const card = transformWyvernCard(char);

    // Add lorebook if present
    if (char.lorebook || char.character_book) {
      card.characterBook = transformWyvernLorebook(
        char.lorebook || char.character_book,
      );
    }

    return card;
  },

  async getTrending(limit = 20): Promise<ExternalCharacterCard[]> {
    // Use the search endpoint with popular sort for trending
    const params = new URLSearchParams({
      limit: String(limit),
      sort: "popular",
      order: "DESC",
    });

    const response = await proxiedFetch(
      `${WYVERN_API_BASE}/characters?${params}`,
      {
        service: "wyvern",
        fetchOptions: {
          headers: { Accept: "application/json" },
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Wyvern trending error ${response.status}`);
    }

    const data = await response.json();

    // Wyvern API returns: { results: [...], total, page, totalPages, hasMore }
    const characters = data.results || [];

    return characters.map(transformWyvernCard);
  },
};

/**
 * Search Wyvern lorebooks
 */
export async function searchWyvernLorebooks(
  options: ExternalSearchOptions,
): Promise<ExternalSearchResult> {
  const { query = "", page = 1, limit = 40, sort = "popular" } = options;

  const params = new URLSearchParams({
    q: query,
    page: String(page),
    limit: String(limit),
    sort: sort === "newest" ? "created_at" : "popularity",
  });

  const response = await proxiedFetch(
    `${WYVERN_API_BASE}/lorebooks/search?${params}`,
    {
      service: "wyvern",
      fetchOptions: {
        headers: { Accept: "application/json" },
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Wyvern lorebooks search error ${response.status}`);
  }

  const data = await response.json();
  const lorebooks = data.lorebooks || data.data || [];

  return {
    cards: lorebooks.map((lb: any) => ({
      id: lb.id || lb.uuid,
      source: "wyvern",
      sourceUrl: `${WYVERN_BASE_URL}/lorebooks/${lb.id || lb.uuid}`,
      name: lb.name || "Unnamed Lorebook",
      creator: lb.creator?.username || "",
      tags: lb.tags || [],
      tagline: lb.description || "",
      description: lb.description || "",
      isNsfw: lb.isNsfw || false,
      rawData: lb,
    })),
    totalHits: data.total || lorebooks.length,
    page,
    totalPages: Math.ceil((data.total || lorebooks.length) / limit),
    hasMore: lorebooks.length >= limit,
    source: "wyvern",
  };
}

export default wyvernSource;
