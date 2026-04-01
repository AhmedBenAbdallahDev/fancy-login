/**
 * External Character Sources - Main Entry Point
 * Provides unified access to all external character sources
 */

import type {
  ExternalCharacterCard,
  ExternalSearchOptions,
  ExternalSearchResult,
  ExternalSourceSlug,
  ImportCharacterData,
} from "app-types/external-character";
import type { ExternalCharacterSource } from "./base-source";
import { jannyaiSource } from "./sources/jannyai";
import { chubSource } from "./sources/chub";
import { wyvernSource } from "./sources/wyvern";
import { characterTavernSource } from "./sources/character-tavern";
import { risuaiSource } from "./sources/risuai";
import { backyardSource } from "./sources/backyard";
import { pygmalionSource } from "./sources/pygmalion";

// Export all sources
export { jannyaiSource } from "./sources/jannyai";
export {
  chubSource,
  getChubLorebook,
  searchChubLorebooks,
} from "./sources/chub";
export { wyvernSource, searchWyvernLorebooks } from "./sources/wyvern";
export { characterTavernSource } from "./sources/character-tavern";
export { risuaiSource } from "./sources/risuai";
export { backyardSource } from "./sources/backyard";
export { pygmalionSource } from "./sources/pygmalion";

// Export utilities
export * from "./cors-proxy";
export * from "./base-source";

// All available sources
const sources: Record<string, ExternalCharacterSource> = {
  jannyai: jannyaiSource,
  chub: chubSource,
  wyvern: wyvernSource,
  character_tavern: characterTavernSource,
  risuai: risuaiSource,
  backyard: backyardSource,
  pygmalion: pygmalionSource,
};

/**
 * Get a specific source by slug
 */
export function getSource(slug: ExternalSourceSlug): ExternalCharacterSource {
  const source = sources[slug];
  if (!source) {
    throw new Error(`Unknown source: ${slug}`);
  }
  return source;
}

/**
 * Get all available sources
 */
export function getAllSources(): ExternalCharacterSource[] {
  return Object.values(sources);
}

/**
 * Search across all sources or a specific source
 */
export async function searchExternalCharacters(
  options: ExternalSearchOptions & { source?: ExternalSourceSlug },
): Promise<ExternalSearchResult> {
  const { source = "all", ...searchOptions } = options;

  if (source === "all") {
    // Search all sources in parallel
    const results = await Promise.allSettled(
      Object.values(sources).map((s) => s.search(searchOptions)),
    );

    const cards: ExternalCharacterCard[] = [];
    let totalHits = 0;

    for (const result of results) {
      if (result.status === "fulfilled") {
        cards.push(...result.value.cards);
        totalHits += result.value.totalHits;
      }
    }

    // Sort combined results
    const sortedCards = sortCards(cards, searchOptions.sort || "popular");

    return {
      cards: sortedCards.slice(0, searchOptions.limit || 40),
      totalHits,
      page: searchOptions.page || 1,
      totalPages: Math.ceil(totalHits / (searchOptions.limit || 40)),
      hasMore: cards.length > (searchOptions.limit || 40),
      source: "all",
    };
  }

  const sourceImpl = getSource(source);
  return sourceImpl.search(searchOptions);
}

/**
 * Get trending characters from all sources or a specific source
 */
export async function getTrendingCharacters(
  source: ExternalSourceSlug = "all",
  limit = 20,
): Promise<ExternalCharacterCard[]> {
  if (source === "all") {
    const results = await Promise.allSettled(
      Object.values(sources)
        .filter((s) => s.getTrending)
        .map((s) =>
          s.getTrending!(Math.ceil(limit / Object.keys(sources).length)),
        ),
    );

    const cards: ExternalCharacterCard[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        cards.push(...result.value);
      }
    }

    return sortCards(cards, "popular").slice(0, limit);
  }

  const sourceImpl = getSource(source);
  if (!sourceImpl.getTrending) {
    return [];
  }
  return sourceImpl.getTrending(limit);
}

/**
 * Get full character details from a source
 */
export async function getExternalCharacter(
  source: ExternalSourceSlug,
  id: string,
  options?: { slug?: string },
): Promise<ExternalCharacterCard> {
  const sourceImpl = getSource(source);
  return sourceImpl.getCharacter(id, options);
}

/**
 * Sort cards by various criteria
 */
function sortCards(
  cards: ExternalCharacterCard[],
  sort: string,
): ExternalCharacterCard[] {
  const sorted = [...cards];

  switch (sort) {
    case "newest":
      return sorted.sort((a, b) => {
        const dateA = a.createdAt?.getTime() || 0;
        const dateB = b.createdAt?.getTime() || 0;
        return dateB - dateA;
      });
    case "popular":
    case "trending":
      return sorted.sort((a, b) => {
        const popA =
          (a.chatCount || 0) + (a.downloadCount || 0) + (a.likeCount || 0);
        const popB =
          (b.chatCount || 0) + (b.downloadCount || 0) + (b.likeCount || 0);
        return popB - popA;
      });
    case "relevance":
    default:
      return sorted;
  }
}

/**
 * Transform ExternalCharacterCard to ImportCharacterData for database import
 */
export function transformToImportData(
  card: ExternalCharacterCard,
): ImportCharacterData {
  return {
    name: card.name,
    tagline: card.tagline,
    description: card.description,
    avatar: card.avatarUrl,
    personality: card.personality,
    systemPrompt: card.systemPrompt,
    greeting: card.firstMessage,
    exampleDialogue: card.exampleDialogue,
    scenario: card.scenario,
    postHistoryInstructions: card.postHistoryInstructions,
    alternateGreetings: card.alternateGreetings,
    tags: card.tags,
    isNSFW: card.isNsfw,
    tokenCount: card.tokenCount,
    externalSource: card.source,
    externalId: card.id,
    externalUrl: card.sourceUrl,
    externalCreator: card.creator,
    originalData: card.rawData,
    characterBook: card.characterBook,
  };
}

/**
 * Filter cards based on user preferences (blocklist, NSFW settings)
 */
export function filterCards(
  cards: ExternalCharacterCard[],
  options: {
    hideNsfw?: boolean;
    tagBlocklist?: string[];
    search?: string;
  },
): ExternalCharacterCard[] {
  const { hideNsfw = false, tagBlocklist = [], search } = options;

  return cards.filter((card) => {
    // NSFW filter
    if (hideNsfw && card.isNsfw) {
      return false;
    }

    // Tag blocklist
    if (tagBlocklist.length > 0) {
      const normalizedBlocklist = tagBlocklist.map((t) =>
        t.toLowerCase().trim(),
      );
      const cardTags = card.tags.map((t) => t.toLowerCase().trim());

      // Check if card has any blocked tags
      if (normalizedBlocklist.some((blocked) => cardTags.includes(blocked))) {
        return false;
      }

      // Check if description/name contains blocked terms
      const searchText =
        `${card.name} ${card.description || ""} ${card.tagline || ""}`.toLowerCase();
      for (const blocked of normalizedBlocklist) {
        const regex = new RegExp(
          `\\b${blocked.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
          "i",
        );
        if (regex.test(searchText)) {
          return false;
        }
      }
    }

    // Text search
    if (search) {
      const searchLower = search.toLowerCase();
      const searchText =
        `${card.name} ${card.creator || ""} ${card.description || ""} ${card.tagline || ""} ${card.tags.join(" ")}`.toLowerCase();
      if (!searchText.includes(searchLower)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Deduplicate cards by ID and source
 */
export function deduplicateCards(
  cards: ExternalCharacterCard[],
): ExternalCharacterCard[] {
  const seen = new Map<string, ExternalCharacterCard>();

  for (const card of cards) {
    const key = `${card.source}:${card.id}`;
    if (!seen.has(key)) {
      seen.set(key, card);
    }
  }

  return Array.from(seen.values());
}

/**
 * Get all unique tags from a list of cards
 */
export function getAllTags(cards: ExternalCharacterCard[]): string[] {
  const tagsMap = new Map<string, string>();

  for (const card of cards) {
    for (const tag of card.tags) {
      const normalized = tag.toLowerCase().trim();
      if (!tagsMap.has(normalized)) {
        tagsMap.set(normalized, tag.trim());
      }
    }
  }

  return Array.from(tagsMap.values()).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  );
}
