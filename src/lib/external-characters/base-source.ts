/**
 * Base interface for external character sources
 * All sources (JannyAI, Chub, Wyvern, etc.) implement this interface
 */

import type {
  ExternalCharacterCard,
  ExternalSearchOptions,
  ExternalSearchResult,
  ExternalSourceSlug,
  ExternalCollection,
  ExternalCollectionResult,
} from "app-types/external-character";

export interface ExternalCharacterSource {
  /** Unique identifier for this source */
  readonly slug: ExternalSourceSlug;

  /** Display name */
  readonly name: string;

  /** Search characters from this source */
  search(options: ExternalSearchOptions): Promise<ExternalSearchResult>;

  /** Get full character details by ID */
  getCharacter(
    id: string,
    options?: { slug?: string },
  ): Promise<ExternalCharacterCard>;

  /** Get trending/popular characters (if supported) */
  getTrending?(limit?: number): Promise<ExternalCharacterCard[]>;

  /** Get collections (if supported - mainly JannyAI) */
  getCollections?(options?: {
    page?: number;
    sort?: "popular" | "new";
  }): Promise<ExternalCollectionResult>;

  /** Get collection details (if supported) */
  getCollectionDetails?(
    collectionId: string,
    slug?: string,
  ): Promise<{
    collection: ExternalCollection;
    characters: ExternalCharacterCard[];
  }>;
}

/**
 * Transform a raw API response to our normalized ExternalCharacterCard format
 * Each source implements its own transformer
 */
export type CardTransformer<T> = (rawCard: T) => ExternalCharacterCard;

/**
 * Strip HTML tags from string
 */
export function stripHtml(html: string | undefined | null): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Generate URL slug from character name
 */
export function generateSlug(name: string): string {
  return (name || "character")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);
}

/**
 * Decode HTML entities
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return "";
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/**
 * Estimate token count from text (rough approximation)
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  // Rough estimate: ~4 chars per token
  return Math.ceil(text.length / 4);
}
