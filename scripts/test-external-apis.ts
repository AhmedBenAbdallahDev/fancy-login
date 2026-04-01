/**
 * Test script for external character APIs
 * Run with: npx tsx scripts/test-external-apis.ts
 */

const JANNY_SEARCH_URL = "https://search.jannyai.com/multi-search";
const JANNY_FALLBACK_TOKEN =
  "88a6463b66e04fb07ba87ee3db06af337f492ce511d93df6e2d2968cb2ff2b30";
const CHUB_API_BASE = "https://api.chub.ai";
const CHUB_GATEWAY_BASE = "https://gateway.chub.ai";

async function testJannyAI() {
  console.log("\n=== Testing JannyAI ===");

  // Test 1: Simple request (no filter, no sort)
  console.log("\nTest 1: Simple request...");
  const simpleBody = {
    queries: [
      {
        indexUid: "janny-characters",
        q: "",
        hitsPerPage: 5,
        page: 1,
      },
    ],
  };

  try {
    const res1 = await fetch(JANNY_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${JANNY_FALLBACK_TOKEN}`,
      },
      body: JSON.stringify(simpleBody),
    });
    console.log(`  Status: ${res1.status}`);
    if (res1.ok) {
      const data = await res1.json();
      console.log(`  Results: ${data.results?.[0]?.hits?.length || 0} hits`);
    } else {
      console.log(`  Error: ${await res1.text()}`);
    }
  } catch (e) {
    console.log(`  Error: ${e}`);
  }

  // Test 2: With filter (like our code does)
  console.log("\nTest 2: With filter array...");
  const filterBody = {
    queries: [
      {
        indexUid: "janny-characters",
        q: "",
        filter: ["totalToken <= 4101 AND totalToken >= 29"],
        hitsPerPage: 5,
        page: 1,
      },
    ],
  };

  try {
    const res2 = await fetch(JANNY_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${JANNY_FALLBACK_TOKEN}`,
      },
      body: JSON.stringify(filterBody),
    });
    console.log(`  Status: ${res2.status}`);
    if (res2.ok) {
      const data = await res2.json();
      console.log(`  Results: ${data.results?.[0]?.hits?.length || 0} hits`);
    } else {
      console.log(`  Error: ${await res2.text()}`);
    }
  } catch (e) {
    console.log(`  Error: ${e}`);
  }

  // Test 3: With sort
  console.log("\nTest 3: With sort...");
  const sortBody = {
    queries: [
      {
        indexUid: "janny-characters",
        q: "",
        sort: ["createdAtStamp:desc"],
        hitsPerPage: 5,
        page: 1,
      },
    ],
  };

  try {
    const res3 = await fetch(JANNY_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${JANNY_FALLBACK_TOKEN}`,
      },
      body: JSON.stringify(sortBody),
    });
    console.log(`  Status: ${res3.status}`);
    if (res3.ok) {
      const data = await res3.json();
      console.log(`  Results: ${data.results?.[0]?.hits?.length || 0} hits`);
    } else {
      console.log(`  Error: ${await res3.text()}`);
    }
  } catch (e) {
    console.log(`  Error: ${e}`);
  }

  // Test 4: Full request like our code
  console.log("\nTest 4: Full request (filter + sort + facets)...");
  const fullBody = {
    queries: [
      {
        indexUid: "janny-characters",
        q: "",
        facets: ["isLowQuality", "tagIds", "totalToken"],
        attributesToCrop: ["description:300"],
        cropMarker: "...",
        filter: ["totalToken <= 4101 AND totalToken >= 29"],
        attributesToHighlight: ["name", "description"],
        highlightPreTag: "__ais-highlight__",
        highlightPostTag: "__/ais-highlight__",
        hitsPerPage: 5,
        page: 1,
        sort: ["createdAtStamp:desc"],
      },
    ],
  };

  try {
    const res4 = await fetch(JANNY_SEARCH_URL, {
      method: "POST",
      headers: {
        Accept: "*/*",
        "Content-Type": "application/json",
        Authorization: `Bearer ${JANNY_FALLBACK_TOKEN}`,
        Origin: "https://jannyai.com",
        Referer: "https://jannyai.com/",
        "x-meilisearch-client":
          "Meilisearch instant-meilisearch (v0.19.0) ; Meilisearch JavaScript (v0.41.0)",
      },
      body: JSON.stringify(fullBody),
    });
    console.log(`  Status: ${res4.status}`);
    if (res4.ok) {
      const data = await res4.json();
      console.log(`  Results: ${data.results?.[0]?.hits?.length || 0} hits`);
      if (data.results?.[0]?.hits?.[0]) {
        console.log(`  First hit: ${data.results[0].hits[0].name}`);
      }
    } else {
      console.log(`  Error: ${await res4.text()}`);
    }
  } catch (e) {
    console.log(`  Error: ${e}`);
  }
}

async function testChub() {
  console.log("\n=== Testing Chub ===");

  // Test Chub API
  console.log("\nTest 1: Chub API search...");
  try {
    const res = await fetch(`${CHUB_API_BASE}/search?first=5&page=1`, {
      headers: { Accept: "application/json" },
    });
    console.log(`  Status: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      console.log(
        `  Results: ${data.data?.nodes?.length || data.nodes?.length || 0} characters`,
      );
    } else {
      console.log(`  Error: ${await res.text()}`);
    }
  } catch (e) {
    console.log(`  Error: ${e}`);
  }

  // Test Chub Gateway (trending)
  console.log("\nTest 2: Chub Gateway trending...");
  try {
    const params = new URLSearchParams({
      special_mode: "trending",
      include_forks: "true",
      search: "",
      page: "1",
      first: "5",
      namespace: "characters",
      nsfw: "true",
      nsfw_only: "false",
      nsfl: "false",
      count: "false",
    });
    const res = await fetch(`${CHUB_GATEWAY_BASE}/search?${params}`, {
      method: "POST",
      headers: { Accept: "application/json" },
    });
    console.log(`  Status: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      console.log(`  Results: ${data.data?.nodes?.length || 0} characters`);
    } else {
      console.log(`  Error: ${await res.text()}`);
    }
  } catch (e) {
    console.log(`  Error: ${e}`);
  }
}

async function testWyvern() {
  console.log("\n=== Testing Wyvern ===");

  // Test correct endpoint
  console.log("\nTest 1: Correct exploreSearch endpoint...");
  try {
    const res = await fetch(
      "https://api.wyvern.chat/exploreSearch/characters?page=1&limit=5&sort=votes&order=DESC",
      {
        headers: { Accept: "application/json" },
      },
    );
    console.log(`  Status: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      console.log(
        `  Results: ${data.results?.length || 0} characters (total: ${data.total || 0})`,
      );
    } else {
      console.log(`  Error: ${await res.text()}`);
    }
  } catch (e) {
    console.log(`  Error: ${e}`);
  }
}

async function testCharacterTavern() {
  console.log("\n=== Testing Character Tavern ===");

  // Test trending endpoint
  console.log("\nTest 1: Trending...");
  try {
    const res = await fetch(
      "https://character-tavern.com/api/homepage/cards?type=trending",
      {
        headers: { Accept: "application/json" },
      },
    );
    console.log(`  Status: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      console.log(`  Results: ${data.hits?.length || 0} characters`);
    } else {
      console.log(`  Error: ${await res.text()}`);
    }
  } catch (e) {
    console.log(`  Error: ${e}`);
  }

  // Test correct search endpoint
  console.log("\nTest 2: Correct search API (/api/search/cards)...");
  try {
    const res = await fetch(
      "https://character-tavern.com/api/search/cards?page=1&limit=5",
      {
        headers: { Accept: "application/json" },
      },
    );
    console.log(`  Status: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      console.log(
        `  Results: ${data.hits?.length || data.characters?.length || 0} characters`,
      );
      console.log(`  Total: ${data.totalHits || "N/A"}`);
    } else {
      console.log(`  Error: ${await res.text()}`);
    }
  } catch (e) {
    console.log(`  Error: ${e}`);
  }
}

async function testBackyard() {
  console.log("\n=== Testing Backyard.ai ===");

  console.log("\nTest 1: Browse trending...");
  try {
    const input = {
      "0": {
        json: {
          tagNames: [],
          sortBy: { type: "Trending", direction: "desc" },
          type: "all",
          direction: "forward",
        },
      },
    };
    const res = await fetch(
      `https://backyard.ai/api/trpc/hub.browse.getHubGroupConfigsForTag?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`,
      {
        headers: { Accept: "*/*" },
      },
    );
    console.log(`  Status: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      const configs =
        data?.[0]?.result?.data?.json?.hubGroupConfigs?.length || 0;
      console.log(`  Results: ${configs} characters`);
    } else {
      console.log(`  Error: ${await res.text()}`);
    }
  } catch (e) {
    console.log(`  Error: ${e}`);
  }
}

async function testPygmalion() {
  console.log("\n=== Testing Pygmalion ===");

  console.log("\nTest 1: Character search...");
  try {
    const res = await fetch(
      "https://server.pygmalion.chat/galatea.v1.PublicCharacterService/CharacterSearch",
      {
        method: "POST",
        headers: {
          Accept: "*/*",
          "Content-Type": "application/json",
          "Connect-Protocol-Version": "1",
        },
        body: JSON.stringify({
          orderBy: "approved_at",
          orderDescending: true,
          includeSensitive: true,
          pageSize: 5,
        }),
      },
    );
    console.log(`  Status: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      console.log(`  Results: ${data.characters?.length || 0} characters`);
      console.log(`  Total: ${data.totalItems || "N/A"}`);
    } else {
      console.log(`  Error: ${await res.text()}`);
    }
  } catch (e) {
    console.log(`  Error: ${e}`);
  }
}

async function testRisuAI() {
  console.log("\n=== Testing RisuAI ===");

  console.log("\nTest 1: __data.json endpoint...");
  try {
    const res = await fetch(
      "https://realm.risuai.net/__data.json?sort=&page=1",
      {
        headers: { Accept: "application/json" },
      },
    );
    console.log(`  Status: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      const hasNodes = data?.nodes?.length > 0;
      console.log(
        `  Response valid: ${hasNodes ? "Yes" : "No"} (${data?.nodes?.length || 0} nodes)`,
      );
    } else {
      console.log(`  Error: ${await res.text()}`);
    }
  } catch (e) {
    console.log(`  Error: ${e}`);
  }
}

async function main() {
  console.log("Testing External Character APIs...\n");

  await testJannyAI();
  await testChub();
  await testWyvern();
  await testCharacterTavern();
  await testBackyard();
  await testPygmalion();
  await testRisuAI();

  console.log("\n=== Done ===\n");
}

main().catch(console.error);
