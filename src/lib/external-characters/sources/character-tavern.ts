/**
 * Character Tavern External Character Source
 */

import type {
  ExternalCharacterCard,
  ExternalSearchOptions,
  ExternalSearchResult,
  LorebookEntry,
} from "app-types/external-character";
import type { ExternalCharacterSource } from "../base-source";
import { proxiedFetch } from "../cors-proxy";

// API endpoints
const CT_API_BASE = "https://character-tavern.com/api";
const CT_BASE_URL = "https://character-tavern.com";
const CT_CARDS_BASE = "https://cards.character-tavern.com";

/**
 * Transform Character Tavern API result to normalized card format
 */
function transformCTCard(hit: any): ExternalCharacterCard {
  const isNsfw =
    hit.isNSFW ||
    (hit.tags || []).some((t: string) => t.toLowerCase() === "nsfw");
  const imageUrl = hit.path ? `${CT_CARDS_BASE}/${hit.path}.png` : "";

  return {
    id: hit.id || hit.path,
    source: "character_tavern",
    sourceUrl: `${CT_BASE_URL}/characters/${hit.path}`,
    name: hit.name || hit.inChatName || "Unnamed",
    creator: hit.author || "",
    avatarUrl: imageUrl,
    tags: hit.tags || [],
    tagline: hit.tagline || "",
    description:
      hit.characterDefinition || hit.pageDescription || hit.tagline || "",
    personality: hit.characterPersonality || "",
    scenario: hit.characterScenario || "",
    firstMessage: hit.characterFirstMessage || "",
    exampleDialogue: hit.characterExampleMessages || "",
    postHistoryInstructions: hit.characterPostHistoryPrompt || "",
    alternateGreetings: hit.alternativeFirstMessage || [],
    isNsfw,
    tokenCount: hit.totalTokens || 0,
    downloadCount: hit.downloads || 0,
    likeCount: hit.likes || 0,
    chatCount: hit.messages || 0,
    createdAt: hit.createdAt ? new Date(hit.createdAt * 1000) : undefined,
    rawData: hit,
  };
}

/**
 * Character Tavern External Character Source Implementation
 */
export const characterTavernSource: ExternalCharacterSource = {
  slug: "character_tavern",
  name: "Character Tavern",

  async search(options: ExternalSearchOptions): Promise<ExternalSearchResult> {
    const { query = "", page = 1, limit = 40, tags = [] } = options;

    const params = new URLSearchParams();
    if (query) params.set("query", query);
    params.set("page", String(page));
    params.set("limit", String(limit));

    if (tags.length > 0) {
      params.set("tags", tags.join(","));
    }

    // Use the correct API endpoint: /api/search/cards
    const response = await proxiedFetch(
      `${CT_API_BASE}/search/cards?${params}`,
      {
        service: "character_tavern",
        fetchOptions: {
          headers: { Accept: "application/json" },
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Character Tavern search error ${response.status}`);
    }

    const data = await response.json();
    const hits = data.hits || data.characters || [];

    return {
      cards: hits.map(transformCTCard),
      totalHits: data.totalHits || hits.length,
      page: data.page || page,
      totalPages:
        data.totalPages || Math.ceil((data.totalHits || hits.length) / limit),
      hasMore: (data.page || page) < (data.totalPages || 1),
      source: "character_tavern",
    };
  },

  async getCharacter(id: string): Promise<ExternalCharacterCard> {
    const response = await proxiedFetch(`${CT_API_BASE}/characters/${id}`, {
      service: "character_tavern",
      fetchOptions: {
        headers: { Accept: "application/json" },
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch Character Tavern character: ${response.status}`,
      );
    }

    const data = await response.json();
    const char = data.character || data;
    const card = transformCTCard(char);

    // Add lorebook if present
    if (char.lorebook?.entries?.length) {
      card.characterBook = {
        name: char.lorebook.name || "Lorebook",
        entries: char.lorebook.entries.map(
          (entry: any, index: number): LorebookEntry => ({
            id: entry.id || index,
            keys: entry.keys || [],
            secondaryKeys: entry.secondary_keys || [],
            content: entry.content || "",
            name: entry.name || `Entry ${index + 1}`,
            enabled: entry.enabled !== false,
            insertionOrder: entry.insertion_order || 100,
            priority: entry.priority || 10,
            position: entry.position || "before_char",
            constant: entry.constant || false,
            selective: entry.selective || true,
          }),
        ),
      };
    }

    return card;
  },

  async getTrending(limit = 20): Promise<ExternalCharacterCard[]> {
    const response = await proxiedFetch(
      `${CT_API_BASE}/homepage/cards?type=trending`,
      {
        service: "character_tavern",
        fetchOptions: {
          headers: { Accept: "application/json" },
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Character Tavern trending error ${response.status}`);
    }

    const data = await response.json();
    const hits = data.hits || [];

    return hits.slice(0, limit).map(transformCTCard);
  },
};

export default characterTavernSource;
