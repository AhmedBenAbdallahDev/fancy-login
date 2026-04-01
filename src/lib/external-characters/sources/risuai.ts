/**
 * RisuAI Realm External Character Source
 * Uses SvelteKit __data.json endpoint
 */

import type {
  ExternalCharacterCard,
  ExternalSearchOptions,
  ExternalSearchResult,
} from "app-types/external-character";
import type { ExternalCharacterSource } from "../base-source";
import { proxiedFetch } from "../cors-proxy";

// API endpoints
const RISU_BASE_URL = "https://realm.risuai.net";
const RISU_DATA_URL = `${RISU_BASE_URL}/__data.json`;
const RISU_IMAGE_BASE = "https://sv.risuai.xyz/resource/";

/**
 * Parse SvelteKit devalue format data
 * SvelteKit serializes data in a special array format where:
 * - data[0] = metadata object with indexes
 * - data[1] = array of card indexes
 * - data[2+] = schema and card data
 */
function parseDevalueData(data: any[]): any[] {
  const cards: any[] = [];

  if (!data || !Array.isArray(data) || data.length < 3) {
    return cards;
  }

  const cardIndexes = data[1];
  if (!Array.isArray(cardIndexes)) {
    return cards;
  }

  // Helper to resolve a value - if it's a number, look it up in data
  const resolveValue = (value: any): any => {
    if (Array.isArray(value)) {
      return value.map((idx) => {
        if (typeof idx === "number" && data[idx] !== undefined) {
          return data[idx];
        }
        return idx;
      });
    }
    return value;
  };

  for (const startIndex of cardIndexes) {
    try {
      const schema = data[startIndex];
      if (!schema || typeof schema !== "object") continue;

      const card: Record<string, any> = {};

      // Extract values using schema indexes
      for (const [key, valueIndex] of Object.entries(schema)) {
        if (typeof valueIndex === "number" && data[valueIndex] !== undefined) {
          card[key] = resolveValue(data[valueIndex]);
        } else {
          card[key] = valueIndex;
        }
      }

      if (card.id && card.name) {
        cards.push(card);
      }
    } catch (e) {
      console.warn("[RisuAI] Failed to parse card:", e);
    }
  }

  return cards;
}

/**
 * Transform RisuAI API result to normalized card format
 */
function transformRisuCard(char: any): ExternalCharacterCard {
  // Build avatar URL
  const avatarUrl = char.img ? `${RISU_IMAGE_BASE}${char.img}` : "";

  return {
    id: char.id,
    source: "risuai",
    sourceUrl: `${RISU_BASE_URL}/character/${char.id}`,
    name: char.name || "Unnamed",
    creator: char.username || "",
    avatarUrl,
    tags: char.tags || [],
    tagline: char.desc?.substring(0, 150) || "",
    description: char.desc || "",
    isNsfw: char.nsfw || false,
    tokenCount: 0,
    downloadCount: char.download || 0,
    likeCount: 0,
    createdAt: undefined,
    rawData: char,
  };
}

/**
 * RisuAI External Character Source Implementation
 */
export const risuaiSource: ExternalCharacterSource = {
  slug: "risuai",
  name: "RisuAI Realm",

  async search(options: ExternalSearchOptions): Promise<ExternalSearchResult> {
    const { query = "", page = 1, sort = "popular", nsfw = true } = options;

    const params = new URLSearchParams();

    // Sort parameter - empty for 'recommended' default
    if (sort === "newest") {
      params.set("sort", "date");
    } else if (sort === "relevance") {
      params.set("sort", "download");
    } else {
      params.set("sort", ""); // Default popular/recommended
    }

    params.set("page", String(page));

    if (query) {
      params.set("q", query);
    }

    if (!nsfw) {
      params.set("nsfw", "false");
    }

    // Cache-busting
    params.set("_t", Date.now().toString());

    const response = await proxiedFetch(`${RISU_DATA_URL}?${params}`, {
      service: "risuai",
      fetchOptions: {
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache",
        },
      },
    });

    if (!response.ok) {
      throw new Error(`RisuAI search error ${response.status}`);
    }

    const json = await response.json();

    // Navigate to the data array - SvelteKit response format
    let nodeData = null;

    if (json?.nodes?.[1]?.data) {
      nodeData = json.nodes[1].data;
    } else if (json?.nodes?.[0]?.data) {
      nodeData = json.nodes[0].data;
    } else if (json?.data) {
      nodeData = json.data;
    } else if (Array.isArray(json?.nodes)) {
      for (let i = 0; i < json.nodes.length; i++) {
        if (json.nodes[i]?.data && Array.isArray(json.nodes[i].data)) {
          nodeData = json.nodes[i].data;
          break;
        }
      }
    }

    if (!nodeData) {
      console.warn("[RisuAI] Could not find data in response");
      return {
        cards: [],
        totalHits: 0,
        page,
        totalPages: 1,
        hasMore: false,
        source: "risuai",
      };
    }

    const cards = parseDevalueData(nodeData);
    const CARDS_PER_PAGE = 48;
    const hasMore = cards.length >= CARDS_PER_PAGE;

    return {
      cards: cards.map(transformRisuCard),
      totalHits: cards.length,
      page,
      totalPages: hasMore ? page + 1 : page,
      hasMore,
      source: "risuai",
    };
  },

  async getCharacter(id: string): Promise<ExternalCharacterCard> {
    // RisuAI uses /api/card/{id} for full character data
    const response = await proxiedFetch(`${RISU_BASE_URL}/api/card/${id}`, {
      service: "risuai",
      fetchOptions: {
        headers: { Accept: "application/json" },
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch RisuAI character: ${response.status}`);
    }

    const data = await response.json();
    const char = data.card || data;

    return {
      id: char.id,
      source: "risuai",
      sourceUrl: `${RISU_BASE_URL}/character/${char.id}`,
      name: char.name || "Unnamed",
      creator: char.creator?.username || "",
      avatarUrl: char.img ? `${RISU_IMAGE_BASE}${char.img}` : "",
      tags: char.tags || [],
      tagline: char.desc?.substring(0, 150) || "",
      description: char.desc || "",
      personality: char.personality || "",
      scenario: char.scenario || "",
      firstMessage: char.firstMessage || char.first_mes || "",
      exampleDialogue: char.exampleDialogue || char.mes_example || "",
      systemPrompt: char.systemPrompt || "",
      alternateGreetings: char.alternateGreetings || [],
      isNsfw: char.nsfw || false,
      tokenCount: 0,
      downloadCount: char.download || 0,
      likeCount: 0,
      createdAt: undefined,
      rawData: data,
    };
  },

  async getTrending(limit = 20): Promise<ExternalCharacterCard[]> {
    // Trending is just popular sort
    const result = await this.search({
      sort: "popular",
      page: 1,
    });
    return result.cards.slice(0, limit);
  },
};

export default risuaiSource;
