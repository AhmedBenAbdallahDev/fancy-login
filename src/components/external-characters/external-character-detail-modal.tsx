"use client";

import { useState, useCallback } from "react";
import useSWR from "swr";
import type { ExternalCharacterCard } from "app-types/external-character";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "ui/dialog";
import { Button } from "ui/button";
import { Badge } from "ui/badge";
import { ScrollArea } from "ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "ui/tabs";
import { fetcher } from "lib/utils";
import {
  Download,
  ExternalLink,
  Loader2,
  MessageSquare,
  Heart,
  BookOpen,
  User,
  Sparkles,
  Copy,
  Check,
  Bookmark,
  Shuffle,
  Dice1,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { isBookmarked, addBookmark, removeBookmark } from "./bookmarks";

interface ExternalCharacterDetailModalProps {
  card: ExternalCharacterCard;
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: (characterId: string, name: string) => void;
  onCreatorClick?: (creator: string) => void;
  onTagClick?: (tag: string) => void;
  onRandomSameSource?: () => void;
  onRandomAnySource?: () => void;
  isRandomMode?: boolean;
  isLoadingRandom?: boolean;
}

export function ExternalCharacterDetailModal({
  card,
  isOpen,
  onClose,
  onImportSuccess,
  onCreatorClick,
  onTagClick,
  onRandomSameSource,
  onRandomAnySource,
  isRandomMode = false,
  isLoadingRandom = false,
}: ExternalCharacterDetailModalProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [bookmarked, setBookmarked] = useState(() =>
    isBookmarked(card.id, card.source),
  );

  // Fetch full details if needed
  const { data: fullCard, isLoading } = useSWR<ExternalCharacterCard>(
    isOpen
      ? `/api/external-characters/${card.source}/${encodeURIComponent(card.id)}`
      : null,
    fetcher,
    {
      fallbackData: card,
      revalidateOnFocus: false,
    },
  );

  const displayCard = fullCard || card;

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const response = await fetch("/api/external-characters/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: displayCard.source,
          externalId: displayCard.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to import character");
      }

      const result = await response.json();
      toast.success(`Imported "${result.character.name}" successfully!`, {
        description: result.hasLorebook
          ? "Lorebook was also imported."
          : undefined,
      });
      onImportSuccess?.(result.character.id, result.character.name);
    } catch (error) {
      toast.error("Failed to import character", {
        description: (error as Error).message,
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleCopy = async (field: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
    toast.success(`Copied ${field}`);
  };

  const handleBookmarkToggle = useCallback(() => {
    if (bookmarked) {
      removeBookmark(card.id, card.source);
      setBookmarked(false);
      toast.success("Removed from bookmarks");
    } else {
      addBookmark(displayCard);
      setBookmarked(true);
      toast.success("Added to bookmarks");
    }
  }, [bookmarked, card.id, card.source, displayCard]);

  const CopyButton = ({ field, value }: { field: string; value: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 px-2"
      onClick={() => handleCopy(field, value)}
    >
      {copiedField === field ? (
        <Check className="size-3" />
      ) : (
        <Copy className="size-3" />
      )}
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-start gap-4">
            {/* Avatar - Clickable to enlarge */}
            <div className="relative size-24 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer group">
              {displayCard.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={displayCard.avatarUrl}
                  alt={displayCard.name}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  onClick={() => window.open(displayCard.avatarUrl, "_blank")}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
                  <span className="text-3xl font-bold text-white/80">
                    {displayCard.name?.[0]?.toUpperCase() || "?"}
                  </span>
                </div>
              )}
              {displayCard.avatarUrl && (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Eye className="size-5 text-white" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl mb-1">
                {displayCard.name}
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2 text-sm">
                {displayCard.creator && (
                  <button
                    className="flex items-center gap-1 hover:text-primary transition-colors"
                    onClick={() => onCreatorClick?.(displayCard.creator!)}
                  >
                    <User className="size-3" />
                    {displayCard.creator}
                  </button>
                )}
                <Badge variant="outline" className="text-xs">
                  {displayCard.source}
                </Badge>
                {displayCard.isNsfw && (
                  <Badge variant="destructive" className="text-xs">
                    NSFW
                  </Badge>
                )}
              </DialogDescription>

              {/* Stats */}
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                {displayCard.chatCount !== undefined &&
                  displayCard.chatCount > 0 && (
                    <span className="flex items-center gap-1">
                      <MessageSquare className="size-4" />
                      {displayCard.chatCount.toLocaleString()} chats
                    </span>
                  )}
                {displayCard.downloadCount !== undefined &&
                  displayCard.downloadCount > 0 && (
                    <span className="flex items-center gap-1">
                      <Download className="size-4" />
                      {displayCard.downloadCount.toLocaleString()} downloads
                    </span>
                  )}
                {displayCard.likeCount !== undefined &&
                  displayCard.likeCount > 0 && (
                    <span className="flex items-center gap-1">
                      <Heart className="size-4" />
                      {displayCard.likeCount.toLocaleString()}
                    </span>
                  )}
                {displayCard.viewCount !== undefined &&
                  displayCard.viewCount > 0 && (
                    <span className="flex items-center gap-1">
                      <Eye className="size-4" />
                      {displayCard.viewCount.toLocaleString()} views
                    </span>
                  )}
                {displayCard.tokenCount !== undefined &&
                  displayCard.tokenCount > 0 && (
                    <span className="flex items-center gap-1">
                      <Sparkles className="size-4" />
                      {displayCard.tokenCount.toLocaleString()} tokens
                    </span>
                  )}
              </div>

              {/* Action buttons in header */}
              <div className="flex items-center gap-2 mt-3">
                <Button
                  variant={bookmarked ? "default" : "outline"}
                  size="sm"
                  onClick={handleBookmarkToggle}
                >
                  <Bookmark
                    className={`size-4 mr-1 ${bookmarked ? "fill-current" : ""}`}
                  />
                  {bookmarked ? "Saved" : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Random Mode Buttons */}
        {isRandomMode && (onRandomSameSource || onRandomAnySource) && (
          <div className="flex gap-2 border-b pb-4 mb-2">
            {onRandomSameSource && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRandomSameSource}
                disabled={isLoadingRandom}
                className="flex-1"
              >
                {isLoadingRandom ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                ) : (
                  <Shuffle className="size-4 mr-2" />
                )}
                Same Source
              </Button>
            )}
            {onRandomAnySource && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRandomAnySource}
                disabled={isLoadingRandom}
                className="flex-1"
              >
                {isLoadingRandom ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                ) : (
                  <Dice1 className="size-4 mr-2" />
                )}
                Any Source
              </Button>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="overview" className="mt-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="personality">Personality</TabsTrigger>
              <TabsTrigger value="greeting">Greeting</TabsTrigger>
              <TabsTrigger value="lorebook">
                Lorebook
                {displayCard.characterBook?.entries?.length ? (
                  <Badge variant="secondary" className="ml-1 text-[10px]">
                    {displayCard.characterBook.entries.length}
                  </Badge>
                ) : null}
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[350px] mt-4">
              <TabsContent value="overview" className="space-y-4 pr-4">
                {/* Tags */}
                {displayCard.tags && displayCard.tags.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Tags</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {displayCard.tags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                          onClick={() => onTagClick?.(tag)}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description */}
                {displayCard.tagline && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Tagline</h4>
                    <p className="text-sm text-muted-foreground">
                      {displayCard.tagline}
                    </p>
                  </div>
                )}

                {displayCard.description && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium">Description</h4>
                      <CopyButton
                        field="description"
                        value={displayCard.description}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {displayCard.description}
                    </p>
                  </div>
                )}

                {displayCard.scenario && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium">Scenario</h4>
                      <CopyButton
                        field="scenario"
                        value={displayCard.scenario}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {displayCard.scenario}
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="personality" className="space-y-4 pr-4">
                {displayCard.personality ? (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium">Personality</h4>
                      <CopyButton
                        field="personality"
                        value={displayCard.personality}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap font-mono bg-muted/50 p-3 rounded">
                      {displayCard.personality}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No personality defined.
                  </p>
                )}

                {displayCard.exampleDialogue && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium">Example Dialogue</h4>
                      <CopyButton
                        field="example dialogue"
                        value={displayCard.exampleDialogue}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap font-mono bg-muted/50 p-3 rounded">
                      {displayCard.exampleDialogue}
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="greeting" className="space-y-4 pr-4">
                {displayCard.firstMessage ? (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium">First Message</h4>
                      <CopyButton
                        field="greeting"
                        value={displayCard.firstMessage}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/50 p-3 rounded">
                      {displayCard.firstMessage}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No greeting defined.
                  </p>
                )}

                {displayCard.alternateGreetings &&
                  displayCard.alternateGreetings.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">
                        Alternate Greetings (
                        {displayCard.alternateGreetings.length})
                      </h4>
                      <div className="space-y-2">
                        {displayCard.alternateGreetings.map((greeting, i) => (
                          <div
                            key={i}
                            className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/50 p-3 rounded"
                          >
                            <div className="text-xs text-muted-foreground/60 mb-1">
                              Greeting {i + 1}
                            </div>
                            {greeting}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </TabsContent>

              <TabsContent value="lorebook" className="space-y-4 pr-4">
                {displayCard.characterBook?.entries?.length ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {displayCard.characterBook.entries.length} lorebook{" "}
                      {displayCard.characterBook.entries.length === 1
                        ? "entry"
                        : "entries"}{" "}
                      will be imported with this character.
                    </p>
                    {displayCard.characterBook.entries
                      .slice(0, 5)
                      .map((entry, i) => (
                        <div
                          key={entry.id || i}
                          className="border rounded-lg p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {entry.name || `Entry ${i + 1}`}
                            </span>
                            <Badge
                              variant={entry.enabled ? "default" : "secondary"}
                              className="text-[10px]"
                            >
                              {entry.enabled ? "Enabled" : "Disabled"}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {entry.keys.map((key, j) => (
                              <Badge
                                key={j}
                                variant="outline"
                                className="text-[10px]"
                              >
                                {key}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {entry.content}
                          </p>
                        </div>
                      ))}
                    {displayCard.characterBook.entries.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center">
                        ... and {displayCard.characterBook.entries.length - 5}{" "}
                        more entries
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <BookOpen className="size-8 text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No lorebook entries
                    </p>
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        )}

        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" asChild>
            <a
              href={displayCard.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="size-4 mr-2" />
              View Original
            </a>
          </Button>
          <Button onClick={handleImport} disabled={isImporting}>
            {isImporting ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Download className="size-4 mr-2" />
                Import Character
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
