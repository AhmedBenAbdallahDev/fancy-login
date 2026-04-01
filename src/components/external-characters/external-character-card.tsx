"use client";

import type { ExternalCharacterCard as CardType } from "app-types/external-character";
import { Badge } from "ui/badge";
import { cn } from "lib/utils";
import { MessageSquare, Download, Heart, Bookmark } from "lucide-react";

interface ExternalCharacterCardProps {
  card: CardType;
  viewMode?: "grid" | "list";
  onClick?: () => void;
  hideNsfw?: boolean;
  isBookmarked?: boolean;
  onBookmarkToggle?: () => void;
}

function formatCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return count.toString();
}

export function ExternalCharacterCard({
  card,
  viewMode = "grid",
  onClick,
  hideNsfw = false,
  isBookmarked = false,
  onBookmarkToggle,
}: ExternalCharacterCardProps) {
  // Source colors
  const sourceColors: Record<string, string> = {
    jannyai: "bg-violet-500",
    chub: "bg-blue-500",
    wyvern: "bg-emerald-500",
    character_tavern: "bg-amber-500",
    risuai: "bg-pink-500",
    backyard: "bg-orange-500",
    pygmalion: "bg-cyan-500",
  };

  if (viewMode === "list") {
    return (
      <div
        onClick={onClick}
        className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
      >
        {/* Avatar */}
        <div className="relative size-12 rounded-lg overflow-hidden flex-shrink-0">
          {card.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.avatarUrl}
              alt={card.name}
              className={cn(
                "w-full h-full object-cover",
                hideNsfw && "blur-lg",
              )}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
              <span className="text-lg font-bold text-white/80">
                {card.name?.[0]?.toUpperCase() || "?"}
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium truncate">{card.name}</h3>
            {card.isNsfw && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                NSFW
              </Badge>
            )}
          </div>
          {card.creator && (
            <p className="text-sm text-muted-foreground truncate">
              by {card.creator}
            </p>
          )}
          {card.tagline && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
              {card.tagline}
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {card.chatCount !== undefined && card.chatCount > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="size-3" />
              {formatCount(card.chatCount)}
            </span>
          )}
          {card.downloadCount !== undefined && card.downloadCount > 0 && (
            <span className="flex items-center gap-1">
              <Download className="size-3" />
              {formatCount(card.downloadCount)}
            </span>
          )}
          {card.likeCount !== undefined && card.likeCount > 0 && (
            <span className="flex items-center gap-1">
              <Heart className="size-3" />
              {formatCount(card.likeCount)}
            </span>
          )}
        </div>

        {/* Source Badge */}
        <Badge
          variant="secondary"
          className={cn(
            "text-[10px]",
            sourceColors[card.source] || "bg-gray-500",
          )}
        >
          {card.source}
        </Badge>
      </div>
    );
  }

  // Grid view
  return (
    <div
      onClick={onClick}
      className="group relative rounded-lg overflow-hidden border bg-card cursor-pointer hover:shadow-lg transition-all"
    >
      {/* Avatar */}
      <div className="aspect-[3/4] relative">
        {card.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.avatarUrl}
            alt={card.name}
            className={cn(
              "w-full h-full object-cover transition-transform group-hover:scale-105",
              hideNsfw && "blur-xl",
            )}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
            <span className="text-4xl font-bold text-white/80">
              {card.name?.[0]?.toUpperCase() || "?"}
            </span>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2 right-2 flex justify-between items-start pointer-events-none">
          <Badge
            variant="secondary"
            className={cn(
              "text-[10px] text-white",
              sourceColors[card.source] || "bg-gray-500",
            )}
          >
            {card.source}
          </Badge>
          <div className="flex items-center gap-1">
            {card.isNsfw && (
              <Badge variant="destructive" className="text-[10px]">
                NSFW
              </Badge>
            )}
          </div>
        </div>

        {/* Bookmark Button - Always visible in corner */}
        {onBookmarkToggle && (
          <button
            className={cn(
              "absolute top-2 right-2 p-1.5 rounded-full transition-all z-10 pointer-events-auto",
              isBookmarked
                ? "bg-primary text-primary-foreground"
                : "bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-primary hover:text-primary-foreground",
            )}
            onClick={(e) => {
              e.stopPropagation();
              onBookmarkToggle();
            }}
          >
            <Bookmark
              className={cn("size-3.5", isBookmarked && "fill-current")}
            />
          </button>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* Hover Actions */}
        <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex gap-2 text-white text-xs">
            {card.chatCount !== undefined && card.chatCount > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare className="size-3" />
                {formatCount(card.chatCount)}
              </span>
            )}
            {card.downloadCount !== undefined && card.downloadCount > 0 && (
              <span className="flex items-center gap-1">
                <Download className="size-3" />
                {formatCount(card.downloadCount)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-2.5">
        <h3 className="font-medium text-sm truncate">{card.name}</h3>
        {card.creator && (
          <p className="text-xs text-muted-foreground truncate">
            by {card.creator}
          </p>
        )}
        {card.tagline && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
            {card.tagline}
          </p>
        )}

        {/* Tags */}
        {card.tags && card.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {card.tags.slice(0, 3).map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="text-[10px] px-1.5 py-0"
              >
                {tag}
              </Badge>
            ))}
            {card.tags.length > 3 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                +{card.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
