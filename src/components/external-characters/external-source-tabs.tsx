"use client";

import type { ExternalSourceSlug } from "app-types/external-character";
import { EXTERNAL_SOURCES } from "app-types/external-character";
import { cn } from "lib/utils";
import { Globe } from "lucide-react";

interface ExternalSourceTabsProps {
  selectedSource: ExternalSourceSlug;
  onSourceChange: (source: ExternalSourceSlug) => void;
}

const SOURCE_ORDER: ExternalSourceSlug[] = [
  "all",
  "jannyai",
  "chub",
  "character_tavern",
  "wyvern",
  "risuai",
  "backyard",
  "pygmalion",
];

export function ExternalSourceTabs({
  selectedSource,
  onSourceChange,
}: ExternalSourceTabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {/* All Sources */}
      <button
        onClick={() => onSourceChange("all")}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
          selectedSource === "all"
            ? "bg-primary text-primary-foreground"
            : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground",
        )}
      >
        <Globe className="size-4" />
        All Sources
      </button>

      {/* Individual Sources */}
      {SOURCE_ORDER.filter((s) => s !== "all").map((slug) => {
        const source = EXTERNAL_SOURCES.find((s) => s.slug === slug);
        if (!source) return null;

        return (
          <button
            key={slug}
            onClick={() => onSourceChange(slug)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
              selectedSource === slug
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground",
            )}
          >
            {source.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={source.iconUrl}
                alt={source.name}
                className="size-4 rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <span className="size-4 rounded bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-[10px] text-white font-bold">
                {source.name[0]}
              </span>
            )}
            {source.name}
          </button>
        );
      })}
    </div>
  );
}
