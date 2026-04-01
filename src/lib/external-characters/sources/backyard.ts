/**
 * Backyard.ai External Character Source
 * Uses tRPC API with batch queries
 */

import type {
  ExternalCharacterCard,
  ExternalSearchOptions,
  ExternalSearchResult,
} from "app-types/external-character";
import type { ExternalCharacterSource } from "../base-source";
import { proxiedFetch } from "../cors-proxy";

// API endpoints
const BACKYARD_API_BASE = "https://backyard.ai/api/trpc";
const BACKYARD_BASE_URL = "https://backyard.ai";

// Sort type options
export const BACKYARD_SORT_TYPES = {
  TRENDING: "Trending",
  POPULAR: "Popularity",
  NEW: "New",
  TOP_RATED: "TopRated",
} as const;

/**
 * Build tRPC batch query URL
 */
function buildTrpcUrl(procedure: string, input: any): string {
  const batchInput = { "0": { json: input } };
  const encoded = encodeURIComponent(JSON.stringify(batchInput));
  return `${BACKYARD_API_BASE}/${procedure}?batch=1&input=${encoded}`;
}

/**
 * Fetch from Backyard.ai tRPC API
 */
async function fetchBackyardApi(procedure: string, input: any): Promise<any> {
  const url = buildTrpcUrl(procedure, input);

  const response = await proxiedFetch(url, {
    service: "backyard",
    fetchOptions: {
      method: "GET",
      headers: {
        Accept: "*/*",
        "Content-Type": "application/json",
      },
    },
  });

  if (!response.ok) {
    throw new Error(`Backyard API error: ${response.status}`);
  }

  const data = await response.json();
  // tRPC batch response format: [{ result: { data: { json: ... } } }]
  return data[0]?.result?.data?.json;
}

/**
 * Transform Backyard character to our format
 */
function transformBackyardCard(char: any): ExternalCharacterCard {
  const config = char.character || char;
  const group = char.group || {};

  // Build avatar URL
  const avatarUrl =
    config.avatar?.imageUri || config.avatar?.avatarUriSquare || "";

  // Extract tags from topics
  const tags = (group.topics || []).map((t: any) => t.name || t);

  // Check NSFW from content rating
  const isNsfw =
    group.contentRating === "adult" || group.contentRating === "explicit";

  return {
    id: config.id || char.id,
    source: "backyard",
    sourceUrl: `${BACKYARD_BASE_URL}/hub/character/${config.id || char.id}`,
    name: config.aiName || config.name || "Unnamed",
    creator: group.creatorName || config.creatorName || "",
    avatarUrl,
    tags,
    tagline: group.headline || config.headline || "",
    description: config.basePrompt || config.description || "",
    personality: config.personality || "",
    scenario: config.scenario || "",
    firstMessage: config.greeting || config.firstMessage || "",
    exampleDialogue: config.exampleDialogue || "",
    systemPrompt: config.systemPrompt || "",
    postHistoryInstructions: config.postHistoryInstructions || "",
    alternateGreetings: config.alternateGreetings || [],
    isNsfw,
    tokenCount: 0,
    downloadCount: group.downloadCount || 0,
    likeCount: group.likeCount || 0,
    viewCount: group.viewCount || 0,
    createdAt: config.createdAt ? new Date(config.createdAt) : undefined,
    rawData: char,
  };
}

/**
 * Backyard.ai External Character Source Implementation
 */
export const backyardSource: ExternalCharacterSource = {
  slug: "backyard",
  name: "Backyard.ai",

  async search(options: ExternalSearchOptions): Promise<ExternalSearchResult> {
    const { query = "", sort = "popular", tags = [], nsfw = true } = options;

    // Map sort to Backyard format
    const sortMap: Record<string, string> = {
      popular: BACKYARD_SORT_TYPES.POPULAR,
      newest: BACKYARD_SORT_TYPES.NEW,
      trending: BACKYARD_SORT_TYPES.TRENDING,
      relevance: BACKYARD_SORT_TYPES.POPULAR,
    };

    const input: any = {
      tagNames: tags,
      sortBy: {
        type: sortMap[sort] || BACKYARD_SORT_TYPES.TRENDING,
        direction: "desc",
      },
      type: nsfw ? "all" : "sfw",
      direction: "forward",
    };

    if (query.trim()) {
      input.search = query.trim();
    }

    const result = await fetchBackyardApi(
      "hub.browse.getHubGroupConfigsForTag",
      input,
    );

    const characters = result?.hubGroupConfigs || [];

    return {
      cards: characters.map(transformBackyardCard),
      totalHits: characters.length,
      page: 1,
      totalPages: result?.nextCursor ? 2 : 1,
      hasMore: !!result?.nextCursor,
      source: "backyard",
    };
  },

  async getCharacter(id: string): Promise<ExternalCharacterCard> {
    const result = await fetchBackyardApi(
      "hub.browse.getHubCharacterConfigById",
      {
        hubCharacterConfigId: id,
        includeStandaloneGroupConfig: true,
      },
    );

    if (!result) {
      throw new Error(`Character not found: ${id}`);
    }

    return transformBackyardCard(result);
  },

  async getTrending(limit = 20): Promise<ExternalCharacterCard[]> {
    const result = await this.search({
      sort: "trending",
      page: 1,
    });
    return result.cards.slice(0, limit);
  },
};

export default backyardSource;
