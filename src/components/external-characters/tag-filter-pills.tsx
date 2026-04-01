"use client";

import { X } from "lucide-react";
import { Badge } from "ui/badge";
import { Button } from "ui/button";
import { cn } from "lib/utils";
import { ScrollArea, ScrollBar } from "ui/scroll-area";

interface TagFilterPillsProps {
  tags: string[];
  selectedTags: string[];
  onToggle: (tag: string) => void;
  onClear: () => void;
}

export function TagFilterPills({
  tags,
  selectedTags,
  onToggle,
  onClear,
}: TagFilterPillsProps) {
  return (
    <div className="space-y-2">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-2 pb-2">
          {tags.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => onToggle(tag)}
                className={cn(
                  "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground",
                )}
              >
                {tag}
              </button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtering:</span>
          {selectedTags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="pl-2 pr-1 py-0.5 gap-1 cursor-pointer hover:bg-secondary/80"
              onClick={() => onToggle(tag)}
            >
              {tag}
              <X className="size-3" />
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={onClear}
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
