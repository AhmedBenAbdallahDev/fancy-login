/**
 * JannyAI External Character Source
 * Uses MeiliSearch API for fast character search
 */

import type {
  ExternalCharacterCard,
  ExternalSearchOptions,
  ExternalSearchResult,
  ExternalCollection,
  ExternalCollectionResult,
} from "app-types/external-character";
import type { ExternalCharacterSource } from "../base-source";
import { stripHtml, generateSlug, decodeHtmlEntities } from "../base-source";
import { proxiedFetch } from "../cors-proxy";

// API endpoints
const JANNY_SEARCH_URL = "https://search.jannyai.com/multi-search";
const JANNY_IMAGE_BASE = "https://image.jannyai.com/bot-avatars/";
const JANNY_BASE_URL = "https://jannyai.com";

// Fallback token (from Bot Browser)
const JANNY_FALLBACK_TOKEN =
  "88a6463b66e04fb07ba87ee3db06af337f492ce511d93df6e2d2968cb2ff2b30";

// Cached token state
let cachedToken: string | null = null;
let tokenFetchPromise: Promise<string> | null = null;

// JannyAI tag ID to name mapping
const JANNYAI_TAG_MAP: Record<number, string> = {
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

// Reverse mapping
const JANNYAI_TAG_IDS: Record<string, number> = Object.fromEntries(
  Object.entries(JANNYAI_TAG_MAP).map(([id, name]) => [
    name.toLowerCase(),
    parseInt(id),
  ]),
);

/**
 * Fetch the MeiliSearch API token from JannyAI's client config
 */
async function getSearchToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  if (tokenFetchPromise) return tokenFetchPromise;

  tokenFetchPromise = (async () => {
    try {
      // Fetch the search page to find the config file
      const pageResponse = await proxiedFetch(
        `${JANNY_BASE_URL}/characters/search`,
        {
          service: "jannyai",
          fetchOptions: {
            headers: {
              Accept: "text/html",
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
          },
        },
      );

      if (!pageResponse.ok) {
        throw new Error(`Failed to fetch search page: ${pageResponse.status}`);
      }

      const pageHtml = await pageResponse.text();

      // Find client-config JS file
      const configMatch = pageHtml.match(/client-config\.[a-zA-Z0-9_-]+\.js/);
      let configPath: string | undefined;

      if (configMatch) {
        configPath = "/_astro/" + configMatch[0];
      } else {
        // Fallback: find SearchPage.js
        const searchPageMatch = pageHtml.match(
          /SearchPage\.[a-zA-Z0-9_-]+\.js/,
        );
        if (searchPageMatch) {
          const searchPageJsResponse = await proxiedFetch(
            `${JANNY_BASE_URL}/_astro/${searchPageMatch[0]}`,
            { service: "jannyai" },
          );
          if (searchPageJsResponse.ok) {
            const searchPageJs = await searchPageJsResponse.text();
            const importMatch = searchPageJs.match(
              /client-config\.[a-zA-Z0-9_-]+\.js/,
            );
            if (importMatch) {
              configPath = "/_astro/" + importMatch[0];
            }
          }
        }
      }

      if (!configPath) {
        throw new Error("Could not find client-config reference");
      }

      // Fetch the config JS file
      const configResponse = await proxiedFetch(
        `${JANNY_BASE_URL}${configPath}`,
        { service: "jannyai" },
      );

      if (!configResponse.ok) {
        throw new Error(`Failed to fetch config: ${configResponse.status}`);
      }

      const configJs = await configResponse.text();

      // Extract the 64-char hex token
      const tokenMatch = configJs.match(/"([a-f0-9]{64})"/);
      if (!tokenMatch) {
        throw new Error("Could not find token in config");
      }

      cachedToken = tokenMatch[1];
      console.log("[JannyAI] Fetched fresh search token");
      return cachedToken;
    } catch (error) {
      console.warn(
        "[JannyAI] Failed to fetch token, using fallback:",
        (error as Error).message,
      );
      cachedToken = JANNY_FALLBACK_TOKEN;
      return cachedToken;
    } finally {
      tokenFetchPromise = null;
    }
  })();

  return tokenFetchPromise;
}

/**
 * Transform JannyAI search hit to normalized card format
 */
function transformJannyCard(hit: any): ExternalCharacterCard {
  // Map tag IDs to tag names
  const tags = (hit.tagIds || [])
    .map((id: number) => JANNYAI_TAG_MAP[id])
    .filter(Boolean);

  // Add NSFW tag if applicable
  if (hit.isNsfw && !tags.includes("NSFW")) {
    tags.unshift("NSFW");
  }

  const slug = generateSlug(hit.name);
  const websiteDesc = stripHtml(hit.description) || "";

  return {
    id: hit.id,
    source: "jannyai",
    sourceUrl: `${JANNY_BASE_URL}/characters/${hit.id}_character-${slug}`,
    name: hit.name || "Unnamed",
    creator: "", // JannyAI doesn't provide creator in search results
    avatarUrl: hit.avatar ? `${JANNY_IMAGE_BASE}${hit.avatar}` : undefined,
    tags,
    tagline: websiteDesc,
    description: websiteDesc,
    isNsfw: hit.isNsfw || false,
    tokenCount: hit.totalToken || 0,
    chatCount: hit.stats?.chatCount || 0,
    messageCount: hit.stats?.messageCount || 0,
    createdAt: hit.createdAt ? new Date(hit.createdAt) : undefined,
    rawData: hit,
  };
}

/**
 * Parse Astro island props from HTML to extract full character data
 */
function parseAstroCharacterProps(html: string): {
  character: any;
  imageUrl: string;
} {
  // Find the astro-island with CharacterButtons which contains full character data
  const astroMatch = html.match(
    /astro-island[^>]*component-export="CharacterButtons"[^>]*props="([^"]+)"/,
  );

  if (!astroMatch) {
    throw new Error("Could not find character data in JannyAI page");
  }

  // Decode HTML entities in the props string
  const propsDecoded = decodeHtmlEntities(astroMatch[1]);

  let propsJson: any;
  try {
    propsJson = JSON.parse(propsDecoded);
  } catch {
    throw new Error("Failed to parse character data from JannyAI page");
  }

  // Astro serializes data in format: [type, value] where type 0 = primitive, 1 = array
  const character = decodeAstroValue(propsJson.character);
  const imageUrl = decodeAstroValue(propsJson.imageUrl);

  return { character, imageUrl };
}

/**
 * Decode Astro's serialized value format
 */
function decodeAstroValue(value: any): any {
  if (!Array.isArray(value)) return value;

  const [type, data] = value;

  if (type === 0) {
    if (typeof data === "object" && data !== null && !Array.isArray(data)) {
      const decoded: Record<string, any> = {};
      for (const [key, val] of Object.entries(data)) {
        decoded[key] = decodeAstroValue(val);
      }
      return decoded;
    }
    return data;
  } else if (type === 1) {
    return data.map((item: any) => decodeAstroValue(item));
  }

  return data;
}

/**
 * Transform full JannyAI character data for import
 */
function transformFullJannyCharacter(
  charData: any,
  imageUrl?: string,
): ExternalCharacterCard {
  const char = charData.character || charData;

  // Map tag IDs to tag names
  const tags = (char.tagIds || [])
    .map((id: number) => JANNYAI_TAG_MAP[id])
    .filter(Boolean);

  if (char.isNsfw && !tags.includes("NSFW")) {
    tags.unshift("NSFW");
  }

  // JannyAI field mapping:
  // - description = short website tagline
  // - personality = main character description/definition
  // - firstMessage = greeting
  // - exampleDialogs = example messages
  // - scenario = scenario
  const websiteDesc = stripHtml(char.description) || "";
  const slug = generateSlug(char.name);

  return {
    id: char.id,
    source: "jannyai",
    sourceUrl: `${JANNY_BASE_URL}/characters/${char.id}_character-${slug}`,
    name: char.name || "Unnamed",
    creator: char.creatorId || "",
    avatarUrl:
      imageUrl ||
      (char.avatar ? `${JANNY_IMAGE_BASE}${char.avatar}` : undefined),
    tags,
    tagline: websiteDesc,
    description: char.personality || "", // Main character description
    personality: char.personality || "",
    scenario: char.scenario || "",
    firstMessage: char.firstMessage || "",
    exampleDialogue: char.exampleDialogs || "",
    systemPrompt: "", // JannyAI doesn't have explicit system prompt
    postHistoryInstructions: "",
    alternateGreetings: [],
    isNsfw: char.isNsfw || false,
    tokenCount: char.totalToken || 0,
    chatCount: char.stats?.chatCount || 0,
    messageCount: char.stats?.messageCount || 0,
    createdAt: char.createdAt ? new Date(char.createdAt) : undefined,
    rawData: charData,
  };
}

/**
 * JannyAI External Character Source Implementation
 */
export const jannyaiSource: ExternalCharacterSource = {
  slug: "jannyai",
  name: "JannyAI",

  async search(options: ExternalSearchOptions): Promise<ExternalSearchResult> {
    const {
      query = "",
      page = 1,
      limit = 40,
      sort = "popular",
      tags = [],
      // nsfw filtering is done client-side for JannyAI
      minTokens = 29,
      maxTokens = 4101,
    } = options;

    // Convert tag names to IDs
    const tagIds = tags
      .map((tag) => JANNYAI_TAG_IDS[tag.toLowerCase()])
      .filter(Boolean);

    // Build filter
    const filters = [
      `totalToken <= ${maxTokens} AND totalToken >= ${minTokens}`,
    ];
    if (tagIds.length > 0) {
      const tagFilter = tagIds.map((id) => `tagIds = ${id}`).join(" OR ");
      filters.push(`(${tagFilter})`);
    }

    // Sort mapping - only sortable attributes: createdAtStamp, name, permanentToken, totalToken
    const sortMap: Record<string, string> = {
      newest: "createdAtStamp:desc",
      popular: "createdAtStamp:desc", // Fallback to newest (chatCount is not sortable)
      relevance: "", // Empty means no sort (use relevance)
      trending: "createdAtStamp:desc", // Fallback to newest
    };

    // Build sort array - only include if we have a valid sort value
    const sortValue = sortMap[sort];
    const sortArray = sortValue ? [sortValue] : undefined;

    const requestBody = {
      queries: [
        {
          indexUid: "janny-characters",
          q: query,
          facets: ["isLowQuality", "tagIds", "totalToken"],
          attributesToCrop: ["description:300"],
          cropMarker: "...",
          filter: filters,
          attributesToHighlight: ["name", "description"],
          highlightPreTag: "__ais-highlight__",
          highlightPostTag: "__/ais-highlight__",
          hitsPerPage: limit,
          page: page,
          ...(sortArray && { sort: sortArray }),
        },
      ],
    };

    const response = await fetch(JANNY_SEARCH_URL, {
      method: "POST",
      headers: {
        Accept: "*/*",
        "Content-Type": "application/json",
        Authorization: `Bearer ${await getSearchToken()}`,
        Origin: JANNY_BASE_URL,
        Referer: `${JANNY_BASE_URL}/`,
        "x-meilisearch-client":
          "Meilisearch instant-meilisearch (v0.19.0) ; Meilisearch JavaScript (v0.41.0)",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`JannyAI search error ${response.status}`);
    }

    const data = await response.json();
    const result = data.results?.[0] || {};
    const hits = result.hits || [];

    return {
      cards: hits.map(transformJannyCard),
      totalHits: result.estimatedTotalHits || result.totalHits || hits.length,
      page: result.page || page,
      totalPages:
        result.totalPages ||
        Math.ceil((result.estimatedTotalHits || hits.length) / limit),
      hasMore: (result.page || page) < (result.totalPages || 1),
      source: "jannyai",
    };
  },

  async getCharacter(
    id: string,
    options?: { slug?: string },
  ): Promise<ExternalCharacterCard> {
    const slug = options?.slug || "character";
    const characterUrl = `${JANNY_BASE_URL}/characters/${id}_${slug}`;

    const response = await proxiedFetch(characterUrl, {
      service: "jannyai",
      fetchOptions: {
        headers: {
          Accept: "text/html",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch JannyAI character: ${response.status}`);
    }

    const html = await response.text();
    const { character, imageUrl } = parseAstroCharacterProps(html);

    return transformFullJannyCharacter({ character }, imageUrl);
  },

  async getTrending(limit = 20): Promise<ExternalCharacterCard[]> {
    const result = await this.search({
      limit,
      sort: "trending",
    });
    return result.cards;
  },

  async getCollections(options?: {
    page?: number;
    sort?: "popular" | "new";
  }): Promise<ExternalCollectionResult> {
    const { page = 1, sort = "popular" } = options || {};
    const url = `${JANNY_BASE_URL}/collections?sort=${sort}&page=${page}`;

    const response = await proxiedFetch(url, {
      service: "jannyai",
      fetchOptions: {
        headers: {
          Accept: "text/html",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch JannyAI collections: ${response.status}`,
      );
    }

    const html = await response.text();
    return parseCollectionsPage(html, page, sort);
  },

  async getCollectionDetails(
    collectionId: string,
    slug?: string,
  ): Promise<{
    collection: ExternalCollection;
    characters: ExternalCharacterCard[];
  }> {
    const fullPath = slug ? `${collectionId}_${slug}` : collectionId;
    const url = `${JANNY_BASE_URL}/collections/${fullPath}`;

    const response = await proxiedFetch(url, {
      service: "jannyai",
      fetchOptions: {
        headers: {
          Accept: "text/html",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch collection: ${response.status}`);
    }

    const html = await response.text();
    return parseCollectionDetailsPage(html, collectionId, slug || "");
  },
};

/**
 * Parse collections list HTML page
 */
function parseCollectionsPage(
  html: string,
  currentPage: number,
  _sort: string,
): ExternalCollectionResult {
  const collections: ExternalCollection[] = [];

  // Parse pagination info
  const paginationMatch = html.match(
    /Showing\s*<span[^>]*>(\d+)<\/span>\s*to\s*<span[^>]*>(\d+)<\/span>\s*of\s*<span[^>]*>(\d+)<\/span>/,
  );
  const totalEntries = paginationMatch ? parseInt(paginationMatch[3]) : 0;
  const entriesPerPage = 20;
  const totalPages = Math.ceil(totalEntries / entriesPerPage);

  // Parse collection links
  const collectionLinkRegex =
    /href="\/collections\/([^"]+)"[^>]*>\s*<h3[^>]*>([^<]+)/g;
  let linkMatch;

  while ((linkMatch = collectionLinkRegex.exec(html)) !== null) {
    const fullPath = linkMatch[1];
    const name = linkMatch[2].trim();

    const pathParts = fullPath.match(/^([a-f0-9-]+)_(.+)$/);
    if (!pathParts) continue;

    const id = pathParts[1];
    const slug = pathParts[2];

    // Find collection section in HTML
    const sectionStart = html.indexOf(`href="/collections/${fullPath}"`);
    if (sectionStart === -1) continue;

    // Extract metadata from section
    const section = html.substring(
      Math.max(0, sectionStart - 2000),
      sectionStart + 2000,
    );

    const countMatch = section.match(/\(\s*(\d+)\s*characters?\)/i);
    const characterCount = countMatch ? parseInt(countMatch[1]) : 0;

    const descMatch = section.match(
      /<p class="mt-4 text-sm text-gray-500[^"]*">([^<]+)<\/p>/,
    );
    const description = descMatch
      ? decodeHtmlEntities(descMatch[1].trim())
      : "";

    const viewsMatch = section.match(/<strong>(\d+)<\/strong>\s*views/);
    const views = viewsMatch ? parseInt(viewsMatch[1]) : 0;

    // Parse preview images
    const previewImages: string[] = [];
    const imgRegex =
      /<img class="h-14 w-14 rounded-full[^"]*"[^>]*src="([^"]+)"/g;
    let imgMatch;
    while (
      (imgMatch = imgRegex.exec(section)) !== null &&
      previewImages.length < 5
    ) {
      previewImages.push(imgMatch[1]);
    }

    collections.push({
      id,
      slug,
      name: decodeHtmlEntities(name),
      description,
      characterCount,
      views,
      previewImages,
      url: `${JANNY_BASE_URL}/collections/${fullPath}`,
      creator: {
        username: "",
        name: "Unknown",
        avatar: "",
      },
    });
  }

  return {
    collections,
    pagination: {
      currentPage,
      totalPages,
      totalEntries,
      hasMore: currentPage < totalPages,
    },
  };
}

/**
 * Parse collection details page
 */
function parseCollectionDetailsPage(
  html: string,
  collectionId: string,
  slug: string,
): {
  collection: ExternalCollection;
  characters: ExternalCharacterCard[];
} {
  // Extract collection name
  const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  const name = nameMatch
    ? decodeHtmlEntities(nameMatch[1].trim())
    : "Collection";

  // Extract description
  const descMatch = html.match(/<p class="text-gray-600[^"]*">([^<]+)<\/p>/);
  const description = descMatch ? decodeHtmlEntities(descMatch[1].trim()) : "";

  // Parse character cards from the collection page
  const characters: ExternalCharacterCard[] = [];

  // Find character card links
  const cardRegex =
    /href="\/characters\/([^"]+)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[\s\S]*?<h3[^>]*>([^<]+)<\/h3>/g;
  let cardMatch;

  while ((cardMatch = cardRegex.exec(html)) !== null) {
    const charPath = cardMatch[1];
    const avatarUrl = cardMatch[2];
    const charName = decodeHtmlEntities(cardMatch[3].trim());

    // Extract character ID from path
    const idMatch = charPath.match(/^([a-f0-9-]+)_/);
    if (!idMatch) continue;

    characters.push({
      id: idMatch[1],
      source: "jannyai",
      sourceUrl: `${JANNY_BASE_URL}/characters/${charPath}`,
      name: charName,
      avatarUrl,
      tags: [],
      isNsfw: false,
    });
  }

  return {
    collection: {
      id: collectionId,
      slug,
      name,
      description,
      characterCount: characters.length,
      previewImages: characters.slice(0, 5).map((c) => c.avatarUrl || ""),
      url: `${JANNY_BASE_URL}/collections/${collectionId}_${slug}`,
      creator: {
        username: "",
        name: "Unknown",
        avatar: "",
      },
    },
    characters,
  };
}

export default jannyaiSource;
