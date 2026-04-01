"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { fetcher, cn } from "lib/utils";
import { CharacterSummary } from "app-types/character";
import { Input } from "ui/input";
import { Button } from "ui/button";
import { ScrollArea, ScrollBar } from "ui/scroll-area";
import {
  Search,
  Heart,
  MessageSquare,
  Loader2,
  Plus,
  AlertCircle,
  Sparkles,
  X,
  Filter,
  TrendingUp,
  Clock,
  Star,
  Globe,
  Grid3X3,
  Layers,
  LayoutList,
  Download,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  MorphingCardStack,
  type CardData,
  type LayoutMode,
} from "ui/morphing-card-stack";
import { useRouter } from "next/navigation";

// Quick filter tags - character-specific categories
const QUICK_TAGS = [
  { id: "female", label: "Female", emoji: "👩" },
  { id: "male", label: "Male", emoji: "👨" },
  { id: "anime", label: "Anime", emoji: "🎌" },
  { id: "fantasy", label: "Fantasy", emoji: "🧙" },
  { id: "romance", label: "Romance", emoji: "💕" },
  { id: "action", label: "Action", emoji: "⚔️" },
  { id: "horror", label: "Horror", emoji: "👻" },
  { id: "sci-fi", label: "Sci-Fi", emoji: "🚀" },
  { id: "oc", label: "OC", emoji: "✨" },
  { id: "nsfw", label: "18+", emoji: "🔞" },
];

type FilterMode = "all" | "public" | "private";

// Format large numbers
function formatCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return count.toString();
}

export function BrowseCharactersList() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [layout, setLayout] = useState<LayoutMode>("grid");
  const [sortBy, setSortBy] = useState<"popular" | "newest" | "likes">(
    "popular",
  );
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Fetch user's characters
  const {
    data: myCharacters,
    isLoading: isLoadingMy,
    error: myError,
  } = useSWR<CharacterSummary[]>("/api/character", fetcher);

  // Fetch public characters
  const {
    data: publicCharacters,
    isLoading: isLoadingPublic,
    error: publicError,
  } = useSWR<CharacterSummary[]>(
    `/api/character/public?sortBy=${sortBy}`,
    fetcher,
  );

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId],
    );
  };

  // Combine all characters
  const allCharacters = useMemo(() => {
    const myCharsList = (myCharacters || []).map((char) => ({
      ...char,
      isOwn: true,
    }));
    const publicCharsList = (publicCharacters || []).map((char) => ({
      ...char,
      isOwn: false,
      isPublic: true,
    }));

    // Remove duplicates (own characters that are also public)
    const myCharIds = new Set(myCharsList.map((c) => c.id));
    const uniquePublic = publicCharsList.filter((c) => !myCharIds.has(c.id));

    return [...myCharsList, ...uniquePublic];
  }, [myCharacters, publicCharacters]);

  // Filter characters
  const filteredCharacters = useMemo(() => {
    let filtered = allCharacters;

    // Apply filter mode
    if (filterMode === "public") {
      filtered = filtered.filter((char) => char.isPublic);
    } else if (filterMode === "private") {
      filtered = filtered.filter((char) => char.isOwn && !char.isPublic);
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name?.toLowerCase().includes(query) ||
          c.tagline?.toLowerCase().includes(query),
      );
    }

    // Apply tag filters
    if (selectedTags.length > 0) {
      filtered = filtered.filter((c) => {
        const charTags = (c.tags || []).map((t) => t.toLowerCase());
        if (selectedTags.includes("nsfw") && c.isNSFW) return true;
        return selectedTags.some((tag) => charTags.includes(tag.toLowerCase()));
      });
    }

    return filtered;
  }, [allCharacters, filterMode, searchQuery, selectedTags]);

  // Featured characters (first 8 public for recommendations)
  const featuredCharacters = useMemo(() => {
    return allCharacters.filter((c) => c.isPublic && !c.isOwn).slice(0, 8);
  }, [allCharacters]);

  // Convert characters to CardData for MorphingCardStack
  const characterCards: CardData[] = useMemo(() => {
    return filteredCharacters.map((char) => ({
      id: char.id,
      title: char.name || "Unnamed Character",
      description: char.tagline || "An AI character",
      icon: char.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={char.avatar}
          alt={char.name}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-600 to-fuchsia-600">
          <span className="text-2xl font-bold text-white/80">
            {char.name?.[0]?.toUpperCase() || "?"}
          </span>
        </div>
      ),
      badge: char.isOwn
        ? char.isPublic
          ? "Public"
          : "Private"
        : char.creatorUsername
          ? `@${char.creatorUsername}`
          : "Deleted Creator",
      onClick: () => router.push(`/character/${char.id}`),
    }));
  }, [filteredCharacters, router]);

  const isLoading = isLoadingMy || isLoadingPublic;
  const error = myError || publicError;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="size-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading characters...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <div className="p-4 rounded-full bg-amber-500/10 mb-4">
          <AlertCircle className="size-8 text-amber-500" />
        </div>
        <p className="text-muted-foreground">
          Could not load characters. Please try again.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Featured Section - Mobile Only */}
      {isMobile &&
        featuredCharacters.length > 0 &&
        filterMode === "all" &&
        !searchQuery &&
        selectedTags.length === 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <h2 className="text-base font-semibold">Recommended</h2>
              </div>
            </div>
            <MorphingCardStack
              cards={characterCards.filter((c) =>
                featuredCharacters.some((f) => f.id === c.id),
              )}
              defaultLayout="stack"
              showLayoutToggle={false}
              className="w-full"
            />
          </div>
        )}

      {/* Controls */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search characters..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9 h-10 rounded-lg bg-muted/30 border-0"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <LayoutToggle layout={layout} setLayout={setLayout} />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground" />
          <div className="flex gap-1.5">
            <FilterPill
              active={filterMode === "all"}
              onClick={() => setFilterMode("all")}
              label="All"
              count={allCharacters.length}
            />
            <FilterPill
              active={filterMode === "public"}
              onClick={() => setFilterMode("public")}
              label="Public"
              count={allCharacters.filter((c) => c.isPublic).length}
            />
            <FilterPill
              active={filterMode === "private"}
              onClick={() => setFilterMode("private")}
              label="Private"
              count={allCharacters.filter((c) => c.isOwn && !c.isPublic).length}
            />
          </div>
        </div>

        {/* Quick Tags - Horizontal scroll */}
        <div className="relative -mx-4 sm:mx-0">
          <ScrollArea className="w-full">
            <div className="flex gap-2 px-4 sm:px-0 pb-2">
              {QUICK_TAGS.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all border",
                    selectedTags.includes(tag.id)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground",
                  )}
                >
                  <span>{tag.emoji}</span>
                  <span>{tag.label}</span>
                </button>
              ))}
              {selectedTags.length > 0 && (
                <button
                  onClick={() => setSelectedTags([])}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                  Clear
                </button>
              )}
            </div>
            <ScrollBar orientation="horizontal" className="invisible" />
          </ScrollArea>
        </div>

        {/* Sort Options */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            Sort:
          </span>
          {[
            { id: "popular", label: "Trending", icon: TrendingUp },
            { id: "newest", label: "New", icon: Clock },
            { id: "likes", label: "Top Rated", icon: Star },
          ].map((option) => (
            <button
              key={option.id}
              onClick={() => setSortBy(option.id as typeof sortBy)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-all",
                sortBy === option.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              <option.icon className="size-3.5" />
              {option.label}
            </button>
          ))}
        </div>

        {/* Create Button */}
        <div className="flex gap-2">
          <Link href="/character/create" className="flex-1">
            <Button className="w-full h-10 rounded-lg gap-2" size="sm">
              <Plus className="size-4" />
              Create Character
            </Button>
          </Link>
          <Link href="/character/browse-external" className="flex-1">
            <Button
              variant="outline"
              className="w-full h-10 rounded-lg gap-2"
              size="sm"
            >
              <Download className="size-4" />
              Import External
            </Button>
          </Link>
        </div>
      </div>

      {/* Characters Display */}
      {filteredCharacters.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
          <div className="p-6 rounded-full bg-muted/50 mb-6">
            <Globe className="size-12 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">
            {searchQuery || selectedTags.length > 0
              ? "No characters found"
              : filterMode === "private"
                ? "No private characters"
                : filterMode === "public"
                  ? "No public characters yet"
                  : "No characters yet"}
          </h3>
          <p className="text-muted-foreground max-w-sm">
            {searchQuery || selectedTags.length > 0
              ? "Try adjusting your search or filters"
              : "Create your first character!"}
          </p>
        </div>
      ) : (
        <>
          {layout === "stack" ? (
            <MorphingCardStack
              cards={characterCards}
              defaultLayout="stack"
              showLayoutToggle={false}
              className="w-full"
            />
          ) : layout === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredCharacters.map((character) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  isOwner={character.isOwn}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredCharacters.map((character) => (
                <CharacterListCard
                  key={character.id}
                  character={character}
                  isOwner={character.isOwn}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Layout Toggle Component
function LayoutToggle({
  layout,
  setLayout,
}: {
  layout: LayoutMode;
  setLayout: (l: LayoutMode) => void;
}) {
  const layoutIcons = {
    stack: Layers,
    grid: Grid3X3,
    list: LayoutList,
  };

  return (
    <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
      {(Object.keys(layoutIcons) as LayoutMode[]).map((mode) => {
        const Icon = layoutIcons[mode];
        return (
          <button
            key={mode}
            onClick={() => setLayout(mode)}
            className={cn(
              "rounded-md p-1.5 transition-all",
              layout === mode
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary",
            )}
            aria-label={`Switch to ${mode} layout`}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}

// Filter Pill Component
function FilterPill({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1 rounded-full text-xs font-medium transition-all",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label} <span className="opacity-70">({count})</span>
    </button>
  );
}

// Character Card (Grid View)
function CharacterCard({
  character,
  isOwner = false,
}: {
  character: any;
  isOwner?: boolean;
}) {
  return (
    <Link href={`/character/${character.id}`} className="group block">
      <div className="relative overflow-hidden rounded-xl bg-card border border-border/40 hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
        <div className="flex p-3 gap-3">
          {/* Avatar */}
          <div className="relative size-16 shrink-0 rounded-lg overflow-hidden bg-muted">
            {character.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={character.avatar}
                alt={character.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-600 to-fuchsia-600">
                <span className="text-xl font-bold text-white/80">
                  {character.name?.[0]?.toUpperCase() || "?"}
                </span>
              </div>
            )}
            {character.isNSFW && (
              <div className="absolute top-1 left-1">
                <span className="px-1 py-0.5 text-[8px] font-bold bg-red-500 text-white rounded uppercase tracking-wide">
                  18+
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                {character.name}
              </h3>
              <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <MessageSquare className="size-3" />
                <span>{formatCount(character.messageCount || 0)}</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
              {character.tagline || "An AI character"}
            </p>

            {/* Creator Name */}
            {!isOwner &&
              (character.creatorUsername ? (
                <Link
                  href={`/creator/${character.creatorUsername}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[10px] text-muted-foreground hover:text-primary transition-colors mt-1"
                >
                  by @{character.creatorUsername}
                </Link>
              ) : (
                <span className="text-[10px] text-red-400/60 mt-1">
                  Deleted Creator
                </span>
              ))}

            <div className="mt-auto pt-2 flex items-center gap-2">
              <div className="flex items-center gap-1 text-rose-500 text-xs font-medium">
                <Heart className="size-3 fill-current" />
                <span>{formatCount(character.likeCount || 0)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Private Badge at Corner */}
        {isOwner && !character.isPublic && (
          <div className="absolute bottom-2 right-2">
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted/80 backdrop-blur-sm text-muted-foreground border border-border/50">
              Private
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

// Character List Card (List View)
function CharacterListCard({
  character,
  isOwner = false,
}: {
  character: any;
  isOwner?: boolean;
}) {
  return (
    <Link href={`/character/${character.id}`} className="group block">
      <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/40 hover:border-primary/40 transition-all duration-300 hover:shadow-md">
        {/* Avatar */}
        <div className="relative size-12 shrink-0 rounded-lg overflow-hidden bg-muted">
          {character.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={character.avatar}
              alt={character.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-600 to-fuchsia-600">
              <span className="text-lg font-bold text-white/80">
                {character.name?.[0]?.toUpperCase() || "?"}
              </span>
            </div>
          )}
          {character.isNSFW && (
            <div className="absolute top-0.5 left-0.5">
              <span className="px-1 py-0.5 text-[8px] font-bold bg-red-500 text-white rounded uppercase tracking-wide">
                18+
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
              {character.name}
            </h3>
            {isOwner && !character.isPublic && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border">
                Private
              </span>
            )}
            {!isOwner &&
              (character.creatorUsername ? (
                <Link
                  href={`/creator/${character.creatorUsername}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
                >
                  @{character.creatorUsername}
                </Link>
              ) : (
                <span className="text-[10px] text-red-400/60">
                  Deleted Creator
                </span>
              ))}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {character.tagline || "An AI character"}
          </p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MessageSquare className="size-3" />
            <span>{formatCount(character.messageCount || 0)}</span>
          </div>
          <div className="flex items-center gap-1 text-rose-500 text-xs font-medium">
            <Heart className="size-3 fill-current" />
            <span>{formatCount(character.likeCount || 0)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
