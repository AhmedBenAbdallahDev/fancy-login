"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import { fetcher } from "lib/utils";
import type {
  ExternalCharacterCard,
  ExternalSourceSlug,
  ExternalSearchResult,
} from "app-types/external-character";
import { ExternalCharacterCard as CharacterCard } from "./external-character-card";
import { ExternalSourceTabs } from "./external-source-tabs";
import { ExternalCharacterSearch } from "./external-character-search";
import { ExternalCharacterDetailModal } from "./external-character-detail-modal";
import { TagFilterPills } from "./tag-filter-pills";
import { AdvancedFilters, type AdvancedFiltersState } from "./advanced-filters";
import { useBookmarks, BookmarksPanel } from "./bookmarks";
import { BulkActions, SelectableCardOverlay } from "./bulk-actions";
import { RandomCardButton } from "./random-card";
import { Button } from "ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "ui/tabs";
import {
  Loader2,
  AlertCircle,
  Grid,
  LayoutList,
  RefreshCw,
  Bookmark,
  Search,
} from "lucide-react";
import { toast } from "sonner";

// Popular tags from JannyAI and Chub
const POPULAR_TAGS = [
  "Female",
  "Male",
  "Anime",
  "Fantasy",
  "Romance",
  "OC",
  "Fictional",
  "Game",
  "Sci-Fi",
  "Horror",
  "Action",
  "Comedy",
  "Drama",
  "Mystery",
  "Slice of Life",
  "Monster Girl",
  "Vampire",
  "Elf",
  "Non-human",
  "Yandere",
];

interface ExternalCharacterBrowserProps {
  defaultSource?: ExternalSourceSlug;
  onImportSuccess?: (characterId: string, name: string) => void;
}

export function ExternalCharacterBrowser({
  defaultSource = "all",
  onImportSuccess,
}: ExternalCharacterBrowserProps) {
  const t = useTranslations("ExternalCharacters");

  // Main state
  const [selectedSource, setSelectedSource] =
    useState<ExternalSourceSlug>(defaultSource);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"popular" | "newest" | "trending">(
    "popular",
  );
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedCard, setSelectedCard] =
    useState<ExternalCharacterCard | null>(null);
  const [hideNsfw, setHideNsfw] = useState(false);
  const [activeTab, setActiveTab] = useState<"browse" | "bookmarks">("browse");

  // Advanced filters
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFiltersState>(
    {},
  );
  const [appliedFilters, setAppliedFilters] = useState<AdvancedFiltersState>(
    {},
  );

  // Bulk selection
  const [bulkSelectEnabled, setBulkSelectEnabled] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Random mode
  const [isRandomMode, setIsRandomMode] = useState(false);
  const [isLoadingRandom, setIsLoadingRandom] = useState(false);

  // Bookmarks
  const { bookmarks, toggleBookmark, checkBookmarked } = useBookmarks();

  // Build search URL with all filters
  const searchUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.append("source", selectedSource);
    if (searchQuery) params.append("q", searchQuery);
    params.append("page", String(page));
    params.append("limit", "40");
    params.append("sort", sortBy);
    selectedTags.forEach((tag) => params.append("tag", tag));
    if (hideNsfw) params.append("hideNsfw", "true");

    // Advanced filters
    if (appliedFilters.minTokens)
      params.append("minTokens", String(appliedFilters.minTokens));
    if (appliedFilters.maxTokens)
      params.append("maxTokens", String(appliedFilters.maxTokens));
    if (appliedFilters.creatorUsername)
      params.append("creator", appliedFilters.creatorUsername);
    if (appliedFilters.excludeTags) {
      appliedFilters.excludeTags
        .split(",")
        .forEach((tag) => params.append("excludeTag", tag.trim()));
    }

    return `/api/external-characters/search?${params.toString()}`;
  }, [
    selectedSource,
    searchQuery,
    page,
    sortBy,
    selectedTags,
    hideNsfw,
    appliedFilters,
  ]);

  // Fetch characters
  const { data, isLoading, error, mutate } = useSWR<ExternalSearchResult>(
    activeTab === "browse" ? searchUrl : null,
    fetcher,
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
    },
  );

  const cards = data?.cards || [];
  const totalHits = data?.totalHits || 0;
  const hasMore = data?.hasMore || false;

  // Reset selection when cards change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [cards]);

  // Handlers
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setPage(1);
  }, []);

  const handleSourceChange = useCallback((source: ExternalSourceSlug) => {
    setSelectedSource(source);
    setPage(1);
    setSelectedIds(new Set());
  }, []);

  const handleTagToggle = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
    setPage(1);
  }, []);

  const handleClearTags = useCallback(() => {
    setSelectedTags([]);
    setPage(1);
  }, []);

  const handleSortChange = useCallback(
    (sort: "popular" | "newest" | "trending") => {
      setSortBy(sort);
      setPage(1);
    },
    [],
  );

  const handleLoadMore = useCallback(() => {
    if (hasMore && !isLoading) {
      setPage((p) => p + 1);
    }
  }, [hasMore, isLoading]);

  const handleRefresh = useCallback(() => {
    mutate();
  }, [mutate]);

  const handleCardClick = useCallback(
    (card: ExternalCharacterCard) => {
      if (bulkSelectEnabled) {
        const key = `${card.source}-${card.id}`;
        setSelectedIds((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(key)) {
            newSet.delete(key);
          } else {
            newSet.add(key);
          }
          return newSet;
        });
      } else {
        setIsRandomMode(false);
        setSelectedCard(card);
      }
    },
    [bulkSelectEnabled],
  );

  const handleCloseDetail = useCallback(() => {
    setSelectedCard(null);
    setIsRandomMode(false);
  }, []);

  const handleImportSuccess = useCallback(
    (characterId: string, name: string) => {
      setSelectedCard(null);
      onImportSuccess?.(characterId, name);
    },
    [onImportSuccess],
  );

  const handleApplyFilters = useCallback(() => {
    setAppliedFilters(advancedFilters);
    setPage(1);
  }, [advancedFilters]);

  const handleClearFilters = useCallback(() => {
    setAdvancedFilters({});
    setAppliedFilters({});
    setPage(1);
  }, []);

  const handleCreatorClick = useCallback((creator: string) => {
    setAdvancedFilters((prev) => ({ ...prev, creatorUsername: creator }));
    setAppliedFilters((prev) => ({ ...prev, creatorUsername: creator }));
    setSelectedCard(null);
    setPage(1);
  }, []);

  const handleTagClick = useCallback(
    (tag: string) => {
      if (!selectedTags.includes(tag)) {
        setSelectedTags((prev) => [...prev, tag]);
        setPage(1);
      }
      setSelectedCard(null);
    },
    [selectedTags],
  );

  // Random card handlers
  const fetchRandomCard = useCallback(async (source?: ExternalSourceSlug) => {
    setIsLoadingRandom(true);
    try {
      const targetSource =
        source ||
        ([
          "jannyai",
          "chub",
          "wyvern",
          "character_tavern",
          "risuai",
          "backyard",
          "pygmalion",
        ][Math.floor(Math.random() * 7)] as ExternalSourceSlug);

      const randomPage = Math.floor(Math.random() * 10) + 1;
      const response = await fetch(
        `/api/external-characters/search?source=${targetSource}&page=${randomPage}&limit=40&sort=popular`,
      );

      if (!response.ok) throw new Error("Failed to fetch");

      const data = await response.json();
      const fetchedCards = data.cards || [];

      if (fetchedCards.length > 0) {
        const randomCard =
          fetchedCards[Math.floor(Math.random() * fetchedCards.length)];
        setIsRandomMode(true);
        setSelectedCard(randomCard);
      } else {
        toast.error("No cards found");
      }
    } catch (_error) {
      toast.error("Failed to get random card");
    } finally {
      setIsLoadingRandom(false);
    }
  }, []);

  const handleRandomSameSource = useCallback(() => {
    if (selectedCard) {
      fetchRandomCard(selectedCard.source);
    }
  }, [selectedCard, fetchRandomCard]);

  const handleRandomAnySource = useCallback(() => {
    fetchRandomCard();
  }, [fetchRandomCard]);

  const handleRandomFromBrowser = useCallback((card: ExternalCharacterCard) => {
    setIsRandomMode(true);
    setSelectedCard(card);
  }, []);

  // Bulk import handler
  const handleBulkImport = useCallback(
    async (cardsToImport: ExternalCharacterCard[]) => {
      for (const card of cardsToImport) {
        try {
          await fetch("/api/external-characters/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              source: card.source,
              externalId: card.id,
            }),
          });
        } catch (error) {
          console.error(`Failed to import ${card.name}:`, error);
        }
      }
    },
    [],
  );

  // Remove bookmark handler
  const handleRemoveBookmark = useCallback(
    (cardId: string, source: string) => {
      const card = bookmarks.find(
        (b) => b.id === cardId && b.source === source,
      );
      if (card) {
        toggleBookmark(card);
      }
    },
    [bookmarks, toggleBookmark],
  );

  return (
    <div className="space-y-4">
      {/* Main Tabs: Browse / Bookmarks */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "browse" | "bookmarks")}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="browse" className="gap-2">
              <Search className="size-4" />
              Browse
            </TabsTrigger>
            <TabsTrigger value="bookmarks" className="gap-2">
              <Bookmark className="size-4" />
              Bookmarks
              {bookmarks.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-primary text-primary-foreground">
                  {bookmarks.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {activeTab === "browse" && (
            <div className="flex items-center gap-2">
              <RandomCardButton
                currentSource={selectedSource}
                onCardSelected={handleRandomFromBrowser}
              />
              <BulkActions
                cards={cards}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                isEnabled={bulkSelectEnabled}
                onToggleEnabled={() => setBulkSelectEnabled((v) => !v)}
                onImport={handleBulkImport}
              />
            </div>
          )}
        </div>

        <TabsContent value="browse" className="mt-4 space-y-4">
          {/* Source Tabs */}
          <ExternalSourceTabs
            selectedSource={selectedSource}
            onSourceChange={handleSourceChange}
          />

          {/* Search & Filters */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <ExternalCharacterSearch
                  value={searchQuery}
                  onChange={handleSearch}
                  sortBy={sortBy}
                  onSortChange={handleSortChange}
                  hideNsfw={hideNsfw}
                  onHideNsfwChange={setHideNsfw}
                />
              </div>
            </div>

            {/* Advanced Filters */}
            <AdvancedFilters
              source={selectedSource}
              filters={advancedFilters}
              onChange={setAdvancedFilters}
              onApply={handleApplyFilters}
              onClear={handleClearFilters}
            />

            {/* Tag Pills */}
            <TagFilterPills
              tags={POPULAR_TAGS}
              selectedTags={selectedTags}
              onToggle={handleTagToggle}
              onClear={handleClearTags}
            />
          </div>

          {/* Results Header */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {isLoading ? (
                t("searching")
              ) : (
                <>
                  {t("charactersFound", { count: totalHits.toLocaleString() })}
                  {selectedTags.length > 0 && (
                    <span className="ml-1">
                      ({t("tagsSelected", { count: selectedTags.length })})
                    </span>
                  )}
                  {appliedFilters.creatorUsername && (
                    <span className="ml-1">
                      by <strong>{appliedFilters.creatorUsername}</strong>
                      <button
                        className="ml-1 text-primary hover:underline"
                        onClick={() => {
                          setAdvancedFilters((prev) => ({
                            ...prev,
                            creatorUsername: "",
                          }));
                          setAppliedFilters((prev) => ({
                            ...prev,
                            creatorUsername: "",
                          }));
                        }}
                      >
                        ×
                      </button>
                    </span>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <RefreshCw
                  className={`size-4 ${isLoading ? "animate-spin" : ""}`}
                />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setViewMode(viewMode === "grid" ? "list" : "grid")
                }
              >
                {viewMode === "grid" ? (
                  <LayoutList className="size-4" />
                ) : (
                  <Grid className="size-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="size-10 text-destructive mb-4" />
              <p className="text-muted-foreground">
                Failed to load characters. Please try again.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={handleRefresh}
              >
                Retry
              </Button>
            </div>
          )}

          {/* Loading State */}
          {isLoading && cards.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="size-10 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading characters...</p>
            </div>
          )}

          {/* Results Grid */}
          {cards.length > 0 && (
            <>
              <div
                className={
                  viewMode === "grid"
                    ? "grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
                    : "space-y-2"
                }
              >
                {cards.map((card) => (
                  <div key={`${card.source}-${card.id}`} className="relative">
                    <CharacterCard
                      card={card}
                      viewMode={viewMode}
                      onClick={() => handleCardClick(card)}
                      hideNsfw={hideNsfw && card.isNsfw}
                      isBookmarked={checkBookmarked(card.id, card.source)}
                      onBookmarkToggle={() => toggleBookmark(card)}
                    />
                    <SelectableCardOverlay
                      isSelected={selectedIds.has(`${card.source}-${card.id}`)}
                      isEnabled={bulkSelectEnabled}
                      onToggle={() => handleCardClick(card)}
                    />
                  </div>
                ))}
              </div>

              {/* Load More */}
              {hasMore && (
                <div className="flex justify-center pt-4">
                  <Button
                    variant="outline"
                    onClick={handleLoadMore}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="size-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Load More"
                    )}
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Empty State */}
          {!isLoading && !error && cards.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-muted-foreground">
                No characters found. Try adjusting your search or filters.
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="bookmarks" className="mt-4">
          <BookmarksPanel
            bookmarks={bookmarks}
            onRemove={handleRemoveBookmark}
            onCardClick={(card) => {
              setIsRandomMode(false);
              setSelectedCard(card);
            }}
            onImportAll={() => handleBulkImport(bookmarks)}
          />
        </TabsContent>
      </Tabs>

      {/* Detail Modal */}
      {selectedCard && (
        <ExternalCharacterDetailModal
          card={selectedCard}
          isOpen={!!selectedCard}
          onClose={handleCloseDetail}
          onImportSuccess={handleImportSuccess}
          onCreatorClick={handleCreatorClick}
          onTagClick={handleTagClick}
          onRandomSameSource={isRandomMode ? handleRandomSameSource : undefined}
          onRandomAnySource={isRandomMode ? handleRandomAnySource : undefined}
          isRandomMode={isRandomMode}
          isLoadingRandom={isLoadingRandom}
        />
      )}
    </div>
  );
}
