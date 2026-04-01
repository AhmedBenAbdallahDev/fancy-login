/**
 * Chub.ai External Character Source
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

// API endpoints
const CHUB_API_BASE = "https://api.chub.ai";
const CHUB_GATEWAY_BASE = "https://gateway.chub.ai";
const CHUB_AVATAR_BASE = "https://avatars.charhub.io/avatars";

/**
 * Transform Chub API search result to normalized card format
 */
function transformChubCard(node: any): ExternalCharacterCard {
  const fullPath = node.fullPath || node.name;
  const creator = fullPath.includes("/") ? fullPath.split("/")[0] : "Unknown";

  // Check for NSFW
  const hasNsfwTag = (node.topics || []).some(
    (t: string) => t.toLowerCase() === "nsfw",
  );
  const isNsfw = node.nsfw_image || node.nsfw || hasNsfwTag;

  return {
    id: fullPath,
    source: "chub",
    sourceUrl: `https://chub.ai/characters/${fullPath}`,
    name: node.name || "Unnamed",
    creator,
    avatarUrl: `${CHUB_AVATAR_BASE}/${fullPath}/chara_card_v2.png`,
    tags: node.topics || [],
    tagline: node.tagline || "",
    description: node.tagline || node.description || "",
    isNsfw,
    tokenCount: node.nTokens || 0,
    downloadCount: node.nChats || 0,
    likeCount: node.starCount || 0,
    createdAt: node.createdAt ? new Date(node.createdAt) : undefined,
    rawData: node,
  };
}

/**
 * Transform full Chub character data for import
 */
function transformFullChubCharacter(charData: any): ExternalCharacterCard {
  const node = charData.node || charData;
  const definition = node.definition || {};
  const fullPath = node.fullPath || definition.name || "";
  const creator = fullPath.includes("/") ? fullPath.split("/")[0] : "Unknown";

  // Get name - prefer project_name
  const name =
    definition.project_name ||
    node.project_name ||
    definition.name ||
    node.name ||
    "Unnamed";

  // Description: Chub's definition.description IS the main character description
  const mainDescription = definition.description || node.description || "";
  const personalityContent = definition.personality || node.personality || "";

  // Combine if both exist
  let stDescription = mainDescription;
  if (personalityContent && personalityContent !== mainDescription) {
    stDescription =
      mainDescription + (mainDescription ? "\n\n" : "") + personalityContent;
  }

  // Check for NSFW
  const hasNsfwTag = (node.topics || []).some(
    (t: string) => t.toLowerCase() === "nsfw",
  );
  const isNsfw = node.nsfw_image || node.nsfw || hasNsfwTag;

  // Process embedded lorebook
  let characterBook: CharacterBook | undefined;
  const embeddedLorebook =
    definition.embedded_lorebook || node.embedded_lorebook;
  if (embeddedLorebook?.entries) {
    const entries = convertLorebookEntries(embeddedLorebook.entries);
    if (entries.length > 0) {
      characterBook = {
        name: embeddedLorebook.name || "Embedded Lorebook",
        entries,
      };
    }
  }

  return {
    id: fullPath,
    source: "chub",
    sourceUrl: `https://chub.ai/characters/${fullPath}`,
    name,
    creator,
    avatarUrl: `${CHUB_AVATAR_BASE}/${fullPath}/chara_card_v2.png`,
    tags: node.topics || [],
    tagline: node.tagline || "",
    description: stDescription,
    personality: personalityContent,
    scenario: definition.scenario || node.scenario || "",
    firstMessage:
      definition.first_message || node.first_message || node.firstMessage || "",
    exampleDialogue:
      definition.example_dialogs ||
      node.example_dialogs ||
      node.exampleDialogs ||
      "",
    systemPrompt:
      definition.system_prompt || node.system_prompt || node.systemPrompt || "",
    postHistoryInstructions:
      definition.post_history_instructions ||
      node.post_history_instructions ||
      "",
    alternateGreetings:
      definition.alternate_greetings ||
      node.alternate_greetings ||
      node.alternateGreetings ||
      [],
    characterBook,
    isNsfw,
    tokenCount: node.nTokens || 0,
    downloadCount: node.nChats || 0,
    likeCount: node.starCount || 0,
    createdAt: node.createdAt ? new Date(node.createdAt) : undefined,
    rawData: charData,
  };
}

/**
 * Convert Chub lorebook entries to our format
 */
function convertLorebookEntries(entries: any): LorebookEntry[] {
  if (!entries) return [];

  const result: LorebookEntry[] = [];

  // Handle both object and array formats
  const entriesArray = Array.isArray(entries)
    ? entries
    : Object.values(entries);

  for (let i = 0; i < entriesArray.length; i++) {
    const entry = entriesArray[i];
    if (!entry) continue;

    result.push({
      id: entry.uid || entry.id || i,
      keys: entry.key || entry.keys || [],
      secondaryKeys: entry.keysecondary || entry.secondary_keys || [],
      content: entry.content || "",
      name: entry.name || entry.comment || `Entry ${i + 1}`,
      comment: entry.comment || "",
      enabled: entry.enabled !== false,
      insertionOrder: entry.order || entry.insertion_order || 100,
      priority: entry.priority || 10,
      position: entry.position || "before_char",
      constant: entry.constant || false,
      selective: entry.selective !== false,
      selectiveLogic: entry.selectiveLogic || entry.selective_logic || 0,
      probability: entry.probability || 100,
      useProbability: entry.useProbability || entry.use_probability || true,
      depth: entry.depth || 4,
      group: entry.group || "",
      caseSensitive: entry.caseSensitive || entry.case_sensitive || false,
      matchWholeWords:
        entry.matchWholeWords || entry.match_whole_words || false,
    });
  }

  return result;
}

/**
 * Fetch standalone lorebook from Chub
 */
export async function getChubLorebook(
  lorebookId: number | string,
): Promise<CharacterBook | null> {
  try {
    const response = await fetch(
      `${CHUB_GATEWAY_BASE}/api/v4/lorebooks/${lorebookId}`,
      {
        headers: { Accept: "application/json" },
      },
    );

    if (!response.ok) return null;

    const data = await response.json();
    const lorebook = data.node || data;

    if (!lorebook.entries) return null;

    return {
      name: lorebook.name || `Lorebook ${lorebookId}`,
      description: lorebook.description || "",
      entries: convertLorebookEntries(lorebook.entries),
    };
  } catch (error) {
    console.warn(`[Chub] Failed to fetch lorebook ${lorebookId}:`, error);
    return null;
  }
}

/**
 * Search Chub lorebooks
 */
export async function searchChubLorebooks(
  options: ExternalSearchOptions,
): Promise<ExternalSearchResult> {
  const {
    query = "",
    page = 1,
    limit = 48,
    sort = "popular",
    tags = [],
    excludeTags = [],
    nsfw = true,
  } = options;

  const params = new URLSearchParams({
    search: query,
    first: String(limit),
    page: String(page),
    namespace: "lorebooks",
    include_forks: "true",
    nsfw: String(nsfw),
    nsfw_only: "false",
    nsfl: String(nsfw),
    asc: "false",
    sort: sort === "newest" ? "created_at" : "star_count",
    count: "false",
  });

  if (tags.length > 0) {
    params.append("topics", tags.join(","));
  }
  if (excludeTags.length > 0) {
    params.append("excludetopics", excludeTags.join(","));
  }

  const response = await fetch(`${CHUB_GATEWAY_BASE}/search?${params}`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Chub lorebooks search error ${response.status}`);
  }

  const data = await response.json();
  const nodes = data?.data?.nodes || [];

  return {
    cards: nodes.map((node: any) => ({
      id: node.fullPath || node.id,
      source: "chub",
      sourceUrl: `https://chub.ai/lorebooks/${node.fullPath}`,
      name: node.name || "Unnamed Lorebook",
      creator: node.fullPath?.split("/")[0] || "Unknown",
      tags: node.topics || [],
      tagline: node.tagline || node.description || "",
      description: node.description || "",
      isNsfw: node.nsfw || false,
      likeCount: node.starCount || 0,
      downloadCount: node.downloadCount || 0,
      rawData: node,
    })),
    totalHits: data?.data?.count || nodes.length,
    page,
    totalPages: Math.ceil((data?.data?.count || nodes.length) / limit),
    hasMore: nodes.length >= limit,
    source: "chub",
  };
}

/**
 * Chub External Character Source Implementation
 */
export const chubSource: ExternalCharacterSource = {
  slug: "chub",
  name: "Chub.ai",

  async search(options: ExternalSearchOptions): Promise<ExternalSearchResult> {
    const {
      query = "",
      page = 1,
      limit = 40,
      sort = "popular",
      tags = [],
      excludeTags = [],
      nsfw = true,
      minTokens,
      maxTokens,
    } = options;

    const params = new URLSearchParams({
      search: query,
      first: String(limit),
      page: String(page),
      sort: sort === "newest" ? "created_at" : "download_count",
      asc: "false",
      nsfw: String(nsfw),
      nsfl: String(nsfw),
    });

    if (tags.length > 0) {
      params.append("tags", tags.join(","));
    }
    if (excludeTags.length > 0) {
      params.append("exclude_tags", excludeTags.join(","));
    }
    if (minTokens) {
      params.append("min_tokens", String(minTokens));
    }
    if (maxTokens) {
      params.append("max_tokens", String(maxTokens));
    }

    const response = await fetch(`${CHUB_API_BASE}/search?${params}`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Chub search error ${response.status}`);
    }

    const data = await response.json();
    // Chub API response: { data: { nodes: [...], count: N } }
    const nodes = data?.data?.nodes || data?.nodes || [];

    return {
      cards: nodes.map(transformChubCard),
      totalHits: data?.data?.count || data?.count || nodes.length,
      page,
      totalPages: Math.ceil((data?.count || nodes.length) / limit),
      hasMore: nodes.length >= limit,
      source: "chub",
    };
  },

  async getCharacter(id: string): Promise<ExternalCharacterCard> {
    // Add cache-busting parameter
    const nocache = Math.random().toString().substring(2);
    const response = await fetch(
      `${CHUB_GATEWAY_BASE}/api/characters/${id}?full=true&nocache=${nocache}`,
      {
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch Chub character: ${response.status}`);
    }

    const data = await response.json();
    const card = transformFullChubCharacter(data);

    // Fetch related lorebooks if no embedded lorebook
    const node = data.node || data;
    const relatedLorebooks = (node.related_lorebooks || []).filter(
      (id: number) => id > 0,
    );

    if (!card.characterBook?.entries?.length && relatedLorebooks.length > 0) {
      const allEntries: LorebookEntry[] = [];

      for (const lorebookId of relatedLorebooks) {
        const lorebook = await getChubLorebook(lorebookId);
        if (lorebook?.entries?.length) {
          allEntries.push(...lorebook.entries);
        }
      }

      if (allEntries.length > 0) {
        // Reassign unique IDs
        for (let i = 0; i < allEntries.length; i++) {
          allEntries[i].id = i + 1;
        }
        card.characterBook = {
          name: "Linked Lorebooks",
          entries: allEntries,
        };
      }
    }

    return card;
  },

  async getTrending(limit = 20): Promise<ExternalCharacterCard[]> {
    const params = new URLSearchParams({
      special_mode: "trending",
      include_forks: "true",
      search: "",
      page: "1",
      first: String(limit),
      namespace: "characters",
      nsfw: "true",
      nsfw_only: "false",
      min_tags: "3",
      nsfl: "false",
      count: "false",
    });

    const response = await fetch(`${CHUB_GATEWAY_BASE}/search?${params}`, {
      method: "POST",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Chub trending error ${response.status}`);
    }

    const data = await response.json();
    const nodes = data?.data?.nodes || [];

    return nodes.map(transformChubCard);
  },
};

export default chubSource;
