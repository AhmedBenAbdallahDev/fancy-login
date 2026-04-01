/**
 * Pygmalion.chat External Character Source
 * Uses Connect RPC protocol at server.pygmalion.chat
 */

import type {
  ExternalCharacterCard,
  ExternalSearchOptions,
  ExternalSearchResult,
} from "app-types/external-character";
import type { ExternalCharacterSource } from "../base-source";
import { proxiedFetch } from "../cors-proxy";

// API endpoints
const PYGMALION_API_BASE =
  "https://server.pygmalion.chat/galatea.v1.PublicCharacterService";
const PYGMALION_BASE_URL = "https://pygmalion.chat";

// Sort type options
export const PYGMALION_SORT_TYPES = {
  NEWEST: "approved_at",
  TOKEN_COUNT: "token_count",
  STARS: "stars",
  NAME: "display_name",
  DOWNLOADS: "downloads",
  VIEWS: "views",
} as const;

/**
 * Fetch from Pygmalion Connect RPC API
 */
async function fetchPygmalionApi(method: string, input: any): Promise<any> {
  const url = `${PYGMALION_API_BASE}/${method}`;

  const response = await proxiedFetch(url, {
    service: "pygmalion",
    fetchOptions: {
      method: "POST",
      headers: {
        Accept: "*/*",
        "Content-Type": "application/json",
        "Connect-Protocol-Version": "1",
      },
      body: JSON.stringify(input),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Pygmalion API error: ${response.status} - ${text}`);
  }

  return response.json();
}

/**
 * Transform Pygmalion character to our format
 */
function transformPygmalionCard(char: any): ExternalCharacterCard {
  const tags = char.tags || [];
  const isNsfw =
    tags.some((t: string) => t.toLowerCase() === "nsfw") || char.isSensitive;

  return {
    id: char.id,
    source: "pygmalion",
    sourceUrl: `${PYGMALION_BASE_URL}/chat/${char.id}`,
    name: char.displayName || char.name || "Unnamed",
    creator: char.owner?.displayName || char.owner?.username || "",
    avatarUrl: char.avatarUrl || "",
    tags,
    tagline: char.description?.substring(0, 150) || "",
    description: char.description || "",
    personality: char.personality || "",
    scenario: char.scenario || "",
    firstMessage: char.greeting || "",
    exampleDialogue: char.exampleDialogue || "",
    systemPrompt: char.systemPrompt || "",
    postHistoryInstructions: char.postHistoryInstructions || "",
    alternateGreetings: char.alternateGreetings || [],
    isNsfw,
    tokenCount: char.tokenCount || 0,
    downloadCount: parseInt(char.downloads) || 0,
    likeCount: parseInt(char.stars) || 0,
    viewCount: parseInt(char.views) || 0,
    createdAt: char.approvedAt ? new Date(char.approvedAt) : undefined,
    rawData: char,
  };
}

/**
 * Pygmalion External Character Source Implementation
 */
export const pygmalionSource: ExternalCharacterSource = {
  slug: "pygmalion",
  name: "Pygmalion.chat",

  async search(options: ExternalSearchOptions): Promise<ExternalSearchResult> {
    const {
      query = "",
      page = 1,
      limit = 60,
      sort = "popular",
      nsfw = true,
    } = options;

    // Map sort to Pygmalion format
    const sortMap: Record<string, string> = {
      popular: PYGMALION_SORT_TYPES.DOWNLOADS,
      newest: PYGMALION_SORT_TYPES.NEWEST,
      trending: PYGMALION_SORT_TYPES.STARS,
      relevance: PYGMALION_SORT_TYPES.DOWNLOADS,
    };

    const input: any = {
      orderBy: sortMap[sort] || PYGMALION_SORT_TYPES.NEWEST,
      orderDescending: true,
      includeSensitive: nsfw,
      pageSize: limit,
    };

    if (query.trim()) {
      input.query = query.trim();
    }

    // API uses 0-indexed pages
    if (page > 1) {
      input.page = page - 1;
    }

    const result = await fetchPygmalionApi("CharacterSearch", input);

    const characters = result.characters || [];
    const totalItems = parseInt(result.totalItems) || 0;

    return {
      cards: characters.map(transformPygmalionCard),
      totalHits: totalItems,
      page,
      totalPages: Math.ceil(totalItems / limit),
      hasMore: characters.length >= limit,
      source: "pygmalion",
    };
  },

  async getCharacter(id: string): Promise<ExternalCharacterCard> {
    const result = await fetchPygmalionApi("Character", {
      characterMetaId: id,
      characterVersionId: "",
    });

    const char = result.character || result;

    // Get full character data
    return {
      id: char.characterMeta?.id || char.id,
      source: "pygmalion",
      sourceUrl: `${PYGMALION_BASE_URL}/chat/${char.characterMeta?.id || char.id}`,
      name:
        char.characterVersion?.displayName ||
        char.characterMeta?.displayName ||
        char.displayName ||
        "Unnamed",
      creator:
        char.owner?.displayName || char.characterMeta?.owner?.displayName || "",
      avatarUrl:
        char.characterVersion?.avatarUrl || char.characterMeta?.avatarUrl || "",
      tags: char.characterMeta?.tags || [],
      tagline: char.characterVersion?.description?.substring(0, 150) || "",
      description: char.characterVersion?.description || "",
      personality: char.characterVersion?.personality || "",
      scenario: char.characterVersion?.scenario || "",
      firstMessage: char.characterVersion?.greeting || "",
      exampleDialogue: char.characterVersion?.exampleDialogue || "",
      systemPrompt: char.characterVersion?.systemPrompt || "",
      postHistoryInstructions:
        char.characterVersion?.postHistoryInstructions || "",
      alternateGreetings: char.characterVersion?.alternateGreetings || [],
      isNsfw: char.characterMeta?.isSensitive || false,
      tokenCount: char.characterVersion?.tokenCount || 0,
      downloadCount: parseInt(char.characterMeta?.downloads) || 0,
      likeCount: parseInt(char.characterMeta?.stars) || 0,
      createdAt: char.characterMeta?.approvedAt
        ? new Date(char.characterMeta.approvedAt)
        : undefined,
      rawData: result,
    };
  },

  async getTrending(limit = 20): Promise<ExternalCharacterCard[]> {
    const result = await this.search({
      sort: "popular",
      page: 1,
      limit,
    });
    return result.cards;
  },
};

export default pygmalionSource;
