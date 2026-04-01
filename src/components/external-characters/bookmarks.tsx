"use client";

import { useState, useCallback, useEffect } from "react";
import type { ExternalCharacterCard } from "app-types/external-character";
import { Button } from "ui/button";
import {
  Bookmark,
  Trash2,
  Download,
  Search,
  Grid,
  LayoutList,
} from "lucide-react";
import { Input } from "ui/input";
import { cn } from "lib/utils";

const BOOKMARKS_STORAGE_KEY = "external_character_bookmarks";

interface BookmarkedCard extends ExternalCharacterCard {
  bookmarkedAt: string;
}

// Bookmark storage functions
export function loadBookmarks(): BookmarkedCard[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error("[Bookmarks] Failed to load:", error);
  }
  return [];
}

export function saveBookmarks(bookmarks: BookmarkedCard[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(bookmarks));
  } catch (error) {
    console.error("[Bookmarks] Failed to save:", error);
  }
}

export function addBookmark(card: ExternalCharacterCard): BookmarkedCard[] {
  const bookmarks = loadBookmarks();
  const exists = bookmarks.find(
    (b) => b.id === card.id && b.source === card.source,
  );
  if (exists) return bookmarks;

  const newBookmark: BookmarkedCard = {
    ...card,
    bookmarkedAt: new Date().toISOString(),
  };
  const updated = [newBookmark, ...bookmarks];
  saveBookmarks(updated);
  return updated;
}

export function removeBookmark(
  cardId: string,
  source: string,
): BookmarkedCard[] {
  const bookmarks = loadBookmarks();
  const updated = bookmarks.filter(
    (b) => !(b.id === cardId && b.source === source),
  );
  saveBookmarks(updated);
  return updated;
}

export function isBookmarked(cardId: string, source: string): boolean {
  const bookmarks = loadBookmarks();
  return bookmarks.some((b) => b.id === cardId && b.source === source);
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<BookmarkedCard[]>([]);

  useEffect(() => {
    setBookmarks(loadBookmarks());
  }, []);

  const toggleBookmark = useCallback((card: ExternalCharacterCard) => {
    const isCurrentlyBookmarked = isBookmarked(card.id, card.source);
    if (isCurrentlyBookmarked) {
      setBookmarks(removeBookmark(card.id, card.source));
    } else {
      setBookmarks(addBookmark(card));
    }
    return !isCurrentlyBookmarked;
  }, []);

  const checkBookmarked = useCallback(
    (cardId: string, source: string) => {
      return bookmarks.some((b) => b.id === cardId && b.source === source);
    },
    [bookmarks],
  );

  return { bookmarks, toggleBookmark, checkBookmarked, setBookmarks };
}

interface BookmarksPanelProps {
  bookmarks: BookmarkedCard[];
  onRemove: (cardId: string, source: string) => void;
  onCardClick: (card: ExternalCharacterCard) => void;
  onImportAll?: () => void;
}

export function BookmarksPanel({
  bookmarks,
  onRemove,
  onCardClick,
  onImportAll,
}: BookmarksPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const filteredBookmarks = bookmarks.filter(
    (card) =>
      card.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.creator?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.tags?.some((t) =>
        t.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
  );

  if (bookmarks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Bookmark className="size-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium mb-2">No bookmarks yet</h3>
        <p className="text-muted-foreground text-sm max-w-sm">
          Click the bookmark icon on any character card to save it here for
          later.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search bookmarks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
          >
            {viewMode === "grid" ? (
              <LayoutList className="size-4" />
            ) : (
              <Grid className="size-4" />
            )}
          </Button>
          {onImportAll && bookmarks.length > 0 && (
            <Button variant="outline" size="sm" onClick={onImportAll}>
              <Download className="size-4 mr-2" />
              Import All ({bookmarks.length})
            </Button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        {filteredBookmarks.length} bookmark
        {filteredBookmarks.length !== 1 && "s"}
        {searchQuery && ` matching "${searchQuery}"`}
      </div>

      {/* Grid/List */}
      <div
        className={cn(
          viewMode === "grid"
            ? "grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
            : "space-y-2",
        )}
      >
        {filteredBookmarks.map((card) => (
          <div
            key={`${card.source}-${card.id}`}
            className={cn(
              "group relative rounded-lg border bg-card overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-primary/50",
              viewMode === "list" && "flex items-center gap-3 p-3",
            )}
            onClick={() => onCardClick(card)}
          >
            {viewMode === "grid" ? (
              <>
                {/* Image */}
                <div className="aspect-[3/4] relative overflow-hidden">
                  {card.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={card.avatarUrl}
                      alt={card.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
                      <span className="text-3xl font-bold text-muted-foreground/50">
                        {card.name[0]}
                      </span>
                    </div>
                  )}

                  {/* NSFW Badge */}
                  {card.isNsfw && (
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-red-500/90 text-white text-[10px] font-medium">
                      NSFW
                    </div>
                  )}

                  {/* Source Badge */}
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/50 text-white text-[10px] font-medium">
                    {card.source}
                  </div>

                  {/* Remove button */}
                  <button
                    className="absolute bottom-2 right-2 p-1.5 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(card.id, card.source);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>

                {/* Info */}
                <div className="p-2">
                  <h4 className="font-medium text-sm truncate">{card.name}</h4>
                  {card.creator && (
                    <p className="text-xs text-muted-foreground truncate">
                      by {card.creator}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* List view avatar */}
                <div className="size-12 rounded-lg overflow-hidden flex-shrink-0">
                  {card.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={card.avatarUrl}
                      alt={card.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
                      <span className="text-lg font-bold text-muted-foreground/50">
                        {card.name[0]}
                      </span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate">{card.name}</h4>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {card.creator && <span>by {card.creator}</span>}
                    <span>•</span>
                    <span>{card.source}</span>
                    {card.isNsfw && (
                      <>
                        <span>•</span>
                        <span className="text-red-500">NSFW</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Remove button */}
                <button
                  className="p-2 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(card.id, card.source);
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
