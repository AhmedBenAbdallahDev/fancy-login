# Bot Browser Integration Plan
## Integrating SillyTavern-BotBrowser into Project Aether

---

## Executive Summary

SillyTavern-BotBrowser is a feature-rich extension that enables browsing and importing AI character bots from 15+ external sources. Key highlights:

- **JannyAI** (your inspiration) - MeiliSearch-powered search with detailed character definitions
- **Chub.ai** - Large character library with lorebooks
- **Wyvern Chat** - Characters + lorebooks
- **Character Tavern**, **Backyard.ai**, **Pygmalion.chat**, **RisuAI Realm**, etc.

### What We Get
1. Browse 100k+ characters across multiple platforms
2. Tag-based filtering (JannyAI has 60+ predefined tags)
3. Import characters with full definitions (personality, scenario, first_message, examples)
4. Lorebook/World Info support
5. Collections browsing (JannyAI user-curated collections)
6. Trending/Popular views per source
7. Bookmarks, recently viewed, import stats

---

## Phase 1: Database Schema Extensions

### 1.1 New Table: `external_character_source`
Track available external sources and their configuration:

```sql
CREATE TABLE external_character_source (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL, -- 'jannyai', 'chub', 'wyvern', etc.
  name TEXT NOT NULL, -- 'JannyAI', 'Chub.ai', etc.
  base_url TEXT NOT NULL,
  api_type TEXT NOT NULL, -- 'meilisearch', 'rest', 'html_scrape'
  enabled BOOLEAN DEFAULT true,
  requires_cors_proxy BOOLEAN DEFAULT false,
  icon_url TEXT,
  config JSONB DEFAULT '{}', -- API keys, tokens, endpoints
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 1.2 New Table: `external_character_tag`
Global tag registry (from JannyAI's 60+ tag system + others):

```sql
CREATE TABLE external_character_tag (
  id SERIAL PRIMARY KEY,
  source_id UUID REFERENCES external_character_source(id),
  external_id INTEGER, -- JannyAI uses numeric IDs
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  category TEXT, -- 'gender', 'genre', 'content', 'style'
  is_nsfw BOOLEAN DEFAULT false,
  UNIQUE(source_id, slug)
);
```

### 1.3 Extend `character` Table
Add fields for imported characters:

```sql
ALTER TABLE character ADD COLUMN IF NOT EXISTS
  external_source TEXT, -- 'jannyai', 'chub', etc.
  external_id TEXT, -- Original ID from source
  external_url TEXT, -- Link to original
  external_creator TEXT, -- Creator on original platform
  scenario TEXT, -- JannyAI/Chub scenario field
  first_message TEXT, -- First greeting (already have `greeting`, consider merge)
  example_dialogue TEXT, -- Already exists as `exampleDialogue`
  post_history_instructions TEXT, -- Some sources have this
  total_tokens INTEGER, -- Token count from source
  imported_at TIMESTAMP,
  last_synced_at TIMESTAMP,
  original_data JSONB; -- Full original card data for reference
```

### 1.4 New Table: `character_lorebook`
Lorebook/World Info entries:

```sql
CREATE TABLE character_lorebook (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID REFERENCES character(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  entries JSONB NOT NULL, -- Array of lorebook entries
  is_embedded BOOLEAN DEFAULT false, -- Embedded vs linked
  source_lorebook_id TEXT, -- If imported from Chub lorebook
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 1.5 New Table: `user_character_bookmark`
User bookmarks for external characters (before import):

```sql
CREATE TABLE user_character_bookmark (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  source TEXT NOT NULL, -- 'jannyai', 'chub', etc.
  external_id TEXT NOT NULL,
  card_data JSONB NOT NULL, -- Cached card data for display
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, source, external_id)
);
```

### 1.6 New Table: `user_import_history`
Track user's import history:

```sql
CREATE TABLE user_import_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  character_id UUID REFERENCES character(id) ON DELETE SET NULL,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  external_name TEXT NOT NULL,
  import_type TEXT NOT NULL, -- 'character', 'lorebook'
  imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Phase 2: API Services Layer

### 2.1 Directory Structure

```
src/lib/external-characters/
├── index.ts                    # Main exports
├── types.ts                    # Shared types
├── cors-proxy.ts              # CORS proxy utilities
├── sources/
│   ├── base-source.ts         # Abstract base class
│   ├── jannyai/
│   │   ├── api.ts             # JannyAI MeiliSearch API
│   │   ├── collections.ts     # Collections API
│   │   ├── transform.ts       # Transform to our format
│   │   └── tags.ts            # Tag ID mappings
│   ├── chub/
│   │   ├── api.ts             # Chub REST API
│   │   ├── lorebooks.ts       # Lorebook API
│   │   └── transform.ts
│   ├── wyvern/
│   │   ├── api.ts
│   │   └── transform.ts
│   ├── character-tavern/
│   │   ├── api.ts
│   │   └── transform.ts
│   ├── backyard/
│   │   ├── api.ts
│   │   └── transform.ts
│   └── pygmalion/
│       ├── api.ts
│       └── transform.ts
├── search.ts                   # Unified search across sources
├── import.ts                   # Import characters to our DB
└── trending.ts                 # Trending aggregator
```

### 2.2 Core Types (`types.ts`)

```typescript
export interface ExternalCharacterCard {
  id: string;
  source: string;
  sourceUrl: string;
  name: string;
  creator?: string;
  avatarUrl?: string;
  tags: string[];
  description?: string;           // Short tagline
  websiteDescription?: string;    // Display description
  personality?: string;           // Full personality
  scenario?: string;
  firstMessage?: string;
  exampleDialogue?: string;
  systemPrompt?: string;
  postHistoryInstructions?: string;
  alternateGreetings?: string[];
  characterBook?: CharacterBook;  // Embedded lorebook
  isNsfw: boolean;
  tokenCount?: number;
  chatCount?: number;
  messageCount?: number;
  createdAt?: Date;
  rawData?: Record<string, any>;  // Original API response
}

export interface CharacterBook {
  name?: string;
  entries: CharacterBookEntry[];
}

export interface CharacterBookEntry {
  id: number;
  keys: string[];
  secondaryKeys?: string[];
  content: string;
  name?: string;
  enabled: boolean;
  insertionOrder: number;
  priority?: number;
  position?: 'before_char' | 'after_char';
  constant?: boolean;
  selective?: boolean;
}

export interface ExternalSearchOptions {
  query?: string;
  page?: number;
  limit?: number;
  sort?: 'newest' | 'popular' | 'relevance';
  tags?: string[];
  excludeTags?: string[];
  nsfw?: boolean;
  minTokens?: number;
  maxTokens?: number;
}

export interface ExternalSearchResult {
  cards: ExternalCharacterCard[];
  totalHits: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

export interface ExternalSource {
  slug: string;
  name: string;
  search(options: ExternalSearchOptions): Promise<ExternalSearchResult>;
  getCharacter(id: string): Promise<ExternalCharacterCard>;
  getTrending?(limit?: number): Promise<ExternalCharacterCard[]>;
}
```

### 2.3 JannyAI Implementation (Priority - Your Inspiration)

```typescript
// src/lib/external-characters/sources/jannyai/api.ts

const JANNY_SEARCH_URL = 'https://search.jannyai.com/multi-search';
const JANNY_IMAGE_BASE = 'https://image.jannyai.com/bot-avatars/';

// Tag ID to name mapping (from Bot Browser)
export const JANNYAI_TAGS: Record<number, string> = {
  1: 'Male', 2: 'Female', 3: 'Non-binary', 4: 'Celebrity', 5: 'OC',
  6: 'Fictional', 7: 'Real', 8: 'Game', 9: 'Anime', 10: 'Historical',
  11: 'Royalty', 12: 'Detective', 13: 'Hero', 14: 'Villain', 15: 'Magical',
  16: 'Non-human', 17: 'Monster', 18: 'Monster Girl', 19: 'Alien', 20: 'Robot',
  21: 'Politics', 22: 'Vampire', 23: 'Giant', 24: 'OpenAI', 25: 'Elf',
  26: 'Multiple', 27: 'VTuber', 28: 'Dominant', 29: 'Submissive', 30: 'Scenario',
  31: 'Pokemon', 32: 'Assistant', 34: 'Non-English', 36: 'Philosophy',
  38: 'RPG', 39: 'Religion', 41: 'Books', 42: 'AnyPOV', 43: 'Angst',
  44: 'Demi-Human', 45: 'Enemies to Lovers', 46: 'Smut', 47: 'MLM',
  48: 'WLW', 49: 'Action', 50: 'Romance', 51: 'Horror', 52: 'Slice of Life',
  53: 'Fantasy', 54: 'Drama', 55: 'Comedy', 56: 'Mystery', 57: 'Sci-Fi',
  59: 'Yandere', 60: 'Furry', 61: 'Movies/TV'
};

export async function searchJannyCharacters(options: ExternalSearchOptions) {
  // Implementation similar to Bot Browser's jannyApi.js
  // Uses MeiliSearch with dynamic token fetching
}

export async function fetchJannyCharacterDetails(characterId: string, slug: string) {
  // Scrapes character page for full data (Astro props parsing)
}
```

---

## Phase 3: API Routes

### 3.1 Route Structure

```
src/app/api/
├── external-characters/
│   ├── search/route.ts         # GET /api/external-characters/search?source=jannyai&q=...
│   ├── [source]/
│   │   ├── route.ts            # GET /api/external-characters/[source] - list
│   │   ├── [id]/route.ts       # GET /api/external-characters/[source]/[id] - details
│   │   └── trending/route.ts   # GET /api/external-characters/[source]/trending
│   ├── sources/route.ts        # GET /api/external-characters/sources - available sources
│   ├── tags/route.ts           # GET /api/external-characters/tags?source=jannyai
│   ├── import/route.ts         # POST /api/external-characters/import
│   ├── bookmarks/route.ts      # GET/POST/DELETE user bookmarks
│   └── collections/
│       ├── route.ts            # GET /api/external-characters/collections (JannyAI)
│       └── [id]/route.ts       # GET collection details
```

### 3.2 Search Route Example

```typescript
// src/app/api/external-characters/search/route.ts

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const source = searchParams.get('source') || 'all';
  const query = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const tags = searchParams.getAll('tag');
  const nsfw = searchParams.get('nsfw') === 'true';
  
  if (source === 'all') {
    // Search multiple sources in parallel
    const results = await Promise.all([
      jannyaiSource.search({ query, page, tags, nsfw }),
      chubSource.search({ query, page, tags, nsfw }),
      // ... other sources
    ]);
    return NextResponse.json(mergeResults(results));
  }
  
  const sourceImpl = getSource(source);
  const results = await sourceImpl.search({ query, page, tags, nsfw });
  return NextResponse.json(results);
}
```

### 3.3 Import Route

```typescript
// src/app/api/external-characters/import/route.ts

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  
  const { source, externalId } = await request.json();
  
  // 1. Fetch full character data from source
  const sourceImpl = getSource(source);
  const externalCard = await sourceImpl.getCharacter(externalId);
  
  // 2. Transform to our Character format
  const characterData = transformToCharacter(externalCard);
  
  // 3. Create character in our DB
  const character = await characterRepository.create(session.user.id, {
    ...characterData,
    externalSource: source,
    externalId: externalId,
    externalUrl: externalCard.sourceUrl,
    originalData: externalCard.rawData,
    importedAt: new Date(),
  });
  
  // 4. Import lorebook if present
  if (externalCard.characterBook?.entries?.length) {
    await lorebookRepository.create(character.id, externalCard.characterBook);
  }
  
  // 5. Track import
  await importHistoryRepository.create({
    userId: session.user.id,
    characterId: character.id,
    source,
    externalId,
    externalName: externalCard.name,
    importType: 'character',
  });
  
  return NextResponse.json(character);
}
```

---

## Phase 4: Frontend Components

### 4.1 Component Structure

```
src/components/external-characters/
├── external-character-browser.tsx    # Main browser page
├── source-selector.tsx               # Source tabs/dropdown
├── character-search.tsx              # Search input + filters
├── character-grid.tsx                # Card grid display
├── character-card.tsx                # Individual card
├── character-detail-modal.tsx        # Full details + import
├── tag-filter.tsx                    # Tag selection (JannyAI style)
├── advanced-filters.tsx              # Token range, etc.
├── collections-browser.tsx           # JannyAI collections
├── trending-carousel.tsx             # Trending per source
├── bookmarks-list.tsx                # User bookmarks
└── import-history.tsx                # User's import history
```

### 4.2 Main Browser Page

```
src/app/(chat)/browse/page.tsx        # Main browse route
src/app/(chat)/browse/[source]/page.tsx # Source-specific browse
```

### 4.3 Character Card Component

```tsx
// src/components/external-characters/character-card.tsx

interface CharacterCardProps {
  card: ExternalCharacterCard;
  onView: () => void;
  onBookmark: () => void;
  isBookmarked: boolean;
}

export function CharacterCard({ card, onView, onBookmark, isBookmarked }: CharacterCardProps) {
  return (
    <div className="group relative rounded-lg overflow-hidden border bg-card hover:shadow-lg transition-all">
      {/* Avatar */}
      <div className="aspect-[3/4] relative">
        <img 
          src={card.avatarUrl} 
          alt={card.name}
          className={cn(
            "w-full h-full object-cover",
            card.isNsfw && "blur-lg" // Optionally blur NSFW
          )}
        />
        {card.isNsfw && (
          <Badge className="absolute top-2 right-2" variant="destructive">NSFW</Badge>
        )}
        <Badge className="absolute top-2 left-2" variant="secondary">
          {card.source}
        </Badge>
      </div>
      
      {/* Info */}
      <div className="p-3">
        <h3 className="font-semibold truncate">{card.name}</h3>
        {card.creator && (
          <p className="text-sm text-muted-foreground">by {card.creator}</p>
        )}
        <p className="text-sm line-clamp-2 mt-1">{card.description}</p>
        
        {/* Tags */}
        <div className="flex flex-wrap gap-1 mt-2">
          {card.tags.slice(0, 3).map(tag => (
            <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
          ))}
        </div>
        
        {/* Stats */}
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          {card.chatCount && <span>💬 {formatCount(card.chatCount)}</span>}
          {card.tokenCount && <span>📝 {card.tokenCount} tokens</span>}
        </div>
      </div>
      
      {/* Actions */}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex gap-2">
          <Button size="sm" onClick={onView}>View</Button>
          <Button size="sm" variant="ghost" onClick={onBookmark}>
            {isBookmarked ? <HeartFilledIcon /> : <HeartIcon />}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

---

## Phase 5: Integration with Existing Characters Page

### 5.1 Add Source Tabs to `/characters`

Update `src/app/(chat)/characters/page.tsx` to include:

```tsx
<Tabs defaultValue="my-characters">
  <TabsList>
    <TabsTrigger value="my-characters">My Characters</TabsTrigger>
    <TabsTrigger value="community">Community</TabsTrigger>
    <TabsTrigger value="browse">Browse External</TabsTrigger>
  </TabsList>
  
  <TabsContent value="my-characters">
    <BrowseCharactersList filterMode="private" />
  </TabsContent>
  
  <TabsContent value="community">
    <BrowseCharactersList filterMode="public" />
  </TabsContent>
  
  <TabsContent value="browse">
    <ExternalCharacterBrowser />
  </TabsContent>
</Tabs>
```

### 5.2 Quick Import Flow

When a user clicks "Import" on an external character:
1. Show confirmation modal with character preview
2. Allow customization before import (edit name, tags, etc.)
3. Import to user's characters
4. Optionally start chat immediately

---

## Phase 6: CORS Proxy Setup

### 6.1 Server-Side Proxy Route

```typescript
// src/app/api/proxy/route.ts

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'Missing URL' }, { status: 400 });
  
  // Whitelist allowed domains
  const allowed = ['jannyai.com', 'chub.ai', 'wyvern.chat', 'character-tavern.com'];
  const urlObj = new URL(url);
  if (!allowed.some(d => urlObj.hostname.includes(d))) {
    return NextResponse.json({ error: 'Domain not allowed' }, { status: 403 });
  }
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ProjectAether/1.0)',
    },
  });
  
  return new NextResponse(response.body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('Content-Type') || 'application/json',
    },
  });
}
```

---

## TODO List

### Database (Priority: High)
- [ ] Create migration for `external_character_source` table
- [ ] Create migration for `external_character_tag` table  
- [ ] Create migration to extend `character` table with external fields
- [ ] Create migration for `character_lorebook` table
- [ ] Create migration for `user_character_bookmark` table
- [ ] Create migration for `user_import_history` table
- [ ] Seed initial sources (JannyAI, Chub, Wyvern, etc.)
- [ ] Seed JannyAI tags (60+ tags with IDs)

### API Services (Priority: High)
- [ ] Create base `ExternalSource` interface and types
- [ ] Implement JannyAI source (search, details, collections)
- [ ] Implement Chub source (search, details, lorebooks)
- [ ] Implement Wyvern source
- [ ] Implement Character Tavern source
- [ ] Implement trending aggregator
- [ ] Create unified search across sources
- [ ] Create import service

### API Routes (Priority: High)
- [ ] `/api/external-characters/sources` - list available sources
- [ ] `/api/external-characters/search` - unified search
- [ ] `/api/external-characters/[source]/[id]` - get character details
- [ ] `/api/external-characters/[source]/trending` - trending per source
- [ ] `/api/external-characters/tags` - get tags for source
- [ ] `/api/external-characters/import` - import character
- [ ] `/api/external-characters/bookmarks` - manage bookmarks
- [ ] `/api/external-characters/collections` - JannyAI collections
- [ ] `/api/proxy` - CORS proxy for external requests

### Frontend (Priority: Medium)
- [ ] Create `ExternalCharacterBrowser` component
- [ ] Create `SourceSelector` tabs component
- [ ] Create `CharacterCard` for external characters
- [ ] Create `CharacterDetailModal` with import button
- [ ] Create `TagFilter` component (JannyAI style)
- [ ] Create `AdvancedFilters` (token range, NSFW toggle)
- [ ] Create `TrendingCarousel` component
- [ ] Create `CollectionsBrowser` for JannyAI
- [ ] Create `BookmarksList` component
- [ ] Create `ImportHistory` component
- [ ] Update `/characters` page with source tabs

### Integration (Priority: Medium)
- [ ] Add "Browse External" tab to characters page
- [ ] Add quick import flow with preview/edit
- [ ] Add "imported from" badge on imported characters
- [ ] Add lorebook viewer/editor for imported characters
- [ ] Add sync/update functionality for imported characters

### Polish (Priority: Low)
- [ ] Add NSFW blur toggle in settings
- [ ] Add tag blocklist in settings
- [ ] Add image proxy fallback chain
- [ ] Add import statistics dashboard
- [ ] Add "recently viewed" cache
- [ ] Add keyboard shortcuts for browsing
- [ ] Add infinite scroll pagination
- [ ] Add search history

---

## JannyAI-Specific Features (Your Focus)

Since JannyAI is your inspiration, prioritize these:

1. **Tag System**: JannyAI has 60+ predefined tags with IDs. We should:
   - Import all tags into our `external_character_tag` table
   - Show JannyAI tags as filter chips
   - Map JannyAI tags to our tags on import

2. **Character Definition Fields**: JannyAI uses:
   - `personality` → main character description
   - `description` → short website tagline
   - `firstMessage` → greeting
   - `exampleDialogs` → example messages
   - `scenario` → scenario

3. **Collections**: JannyAI has user-curated collections
   - Browse collections by popularity/newest
   - View collection with all characters
   - One-click import entire collection

4. **MeiliSearch**: JannyAI uses MeiliSearch for fast search
   - Fetch dynamic API token from their JS
   - Use facets for tag filtering
   - Support their sort options

---

## Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Database | 2-3 days | None |
| Phase 2: API Services | 4-5 days | Phase 1 |
| Phase 3: API Routes | 2-3 days | Phase 2 |
| Phase 4: Frontend | 5-7 days | Phase 3 |
| Phase 5: Integration | 2-3 days | Phase 4 |
| Phase 6: Polish | 3-5 days | Phase 5 |

**Total: ~3-4 weeks for full implementation**

---

## Quick Start: JannyAI MVP

For a minimal viable integration focused on JannyAI:

1. **Day 1-2**: Database schema + JannyAI tags
2. **Day 3-4**: JannyAI API service (search + details)
3. **Day 5-6**: API routes for search/details/import
4. **Day 7-8**: Basic browse UI with search + grid
5. **Day 9-10**: Import flow + detail modal

This gets you a working "Browse JannyAI" feature in ~2 weeks.
