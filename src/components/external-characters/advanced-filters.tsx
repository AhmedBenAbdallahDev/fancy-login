"use client";

import { useState } from "react";
import { Button } from "ui/button";
import { Input } from "ui/input";
import { Label } from "ui/label";
import { Checkbox } from "ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "ui/collapsible";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { cn } from "lib/utils";

export interface AdvancedFiltersState {
  minTokens?: number;
  maxTokens?: number;
  maxDaysAgo?: number;
  creatorUsername?: string;
  includeTags?: string;
  excludeTags?: string;
  minRating?: number;
  requireExamples?: boolean;
  requireLorebook?: boolean;
  requireGreetings?: boolean;
  contentRating?: "all" | "sfw" | "mature" | "explicit";
  hasLorebook?: boolean;
  isOriginal?: boolean;
}

interface AdvancedFiltersProps {
  source: string;
  filters: AdvancedFiltersState;
  onChange: (filters: AdvancedFiltersState) => void;
  onApply: () => void;
  onClear: () => void;
}

export function AdvancedFilters({
  source,
  filters,
  onChange,
  onApply,
  onClear,
}: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const updateFilter = <K extends keyof AdvancedFiltersState>(
    key: K,
    value: AdvancedFiltersState[K],
  ) => {
    onChange({ ...filters, [key]: value });
  };

  const hasActiveFilters = Object.values(filters).some(
    (v) => v !== undefined && v !== "" && v !== false,
  );

  // Source-specific filter visibility
  const showChubFilters = source === "chub" || source === "all";
  const showWyvernFilters = source === "wyvern" || source === "all";
  const showCTFilters = source === "character_tavern" || source === "all";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center gap-2">
        <CollapsibleTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "gap-2",
              hasActiveFilters && "border-primary text-primary",
            )}
          >
            <SlidersHorizontal className="size-4" />
            Advanced Filters
            {hasActiveFilters && (
              <span className="size-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                {
                  Object.values(filters).filter(
                    (v) => v !== undefined && v !== "" && v !== false,
                  ).length
                }
              </span>
            )}
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                isOpen && "rotate-180",
              )}
            />
          </Button>
        </CollapsibleTrigger>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-muted-foreground"
          >
            <X className="size-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      <CollapsibleContent className="mt-4">
        <div className="rounded-lg border bg-card p-4 space-y-4">
          {/* Token Range - Universal */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minTokens">Min Tokens</Label>
              <Input
                id="minTokens"
                type="number"
                min={0}
                placeholder="0"
                value={filters.minTokens || ""}
                onChange={(e) =>
                  updateFilter(
                    "minTokens",
                    e.target.value ? parseInt(e.target.value) : undefined,
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxTokens">Max Tokens</Label>
              <Input
                id="maxTokens"
                type="number"
                min={0}
                placeholder="Any"
                value={filters.maxTokens || ""}
                onChange={(e) =>
                  updateFilter(
                    "maxTokens",
                    e.target.value ? parseInt(e.target.value) : undefined,
                  )
                }
              />
            </div>
          </div>

          {/* Created Within - Chub */}
          {showChubFilters && (
            <div className="space-y-2">
              <Label htmlFor="maxDaysAgo">Created Within (days)</Label>
              <Input
                id="maxDaysAgo"
                type="number"
                min={1}
                placeholder="Any time"
                value={filters.maxDaysAgo || ""}
                onChange={(e) =>
                  updateFilter(
                    "maxDaysAgo",
                    e.target.value ? parseInt(e.target.value) : undefined,
                  )
                }
              />
            </div>
          )}

          {/* Creator Username */}
          <div className="space-y-2">
            <Label htmlFor="creatorUsername">Creator Username</Label>
            <Input
              id="creatorUsername"
              type="text"
              placeholder="Filter by creator..."
              value={filters.creatorUsername || ""}
              onChange={(e) => updateFilter("creatorUsername", e.target.value)}
            />
          </div>

          {/* Include/Exclude Tags */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="includeTags">Include Tags</Label>
              <Input
                id="includeTags"
                type="text"
                placeholder="fantasy, romance"
                value={filters.includeTags || ""}
                onChange={(e) => updateFilter("includeTags", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Comma-separated</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="excludeTags">Exclude Tags</Label>
              <Input
                id="excludeTags"
                type="text"
                placeholder="nsfl, gore"
                value={filters.excludeTags || ""}
                onChange={(e) => updateFilter("excludeTags", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Comma-separated</p>
            </div>
          </div>

          {/* Content Rating - Wyvern */}
          {showWyvernFilters && (
            <div className="space-y-2">
              <Label>Content Rating</Label>
              <Select
                value={filters.contentRating || "all"}
                onValueChange={(v) =>
                  updateFilter(
                    "contentRating",
                    v as AdvancedFiltersState["contentRating"],
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Content" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Content</SelectItem>
                  <SelectItem value="sfw">SFW Only</SelectItem>
                  <SelectItem value="mature">Mature</SelectItem>
                  <SelectItem value="explicit">Explicit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Min Rating - Chub */}
          {showChubFilters && (
            <div className="space-y-2">
              <Label>Minimum AI Rating</Label>
              <Select
                value={String(filters.minRating || "")}
                onValueChange={(v) =>
                  updateFilter("minRating", v ? parseInt(v) : undefined)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Any</SelectItem>
                  <SelectItem value="1">1+ Stars</SelectItem>
                  <SelectItem value="2">2+ Stars</SelectItem>
                  <SelectItem value="3">3+ Stars</SelectItem>
                  <SelectItem value="4">4+ Stars</SelectItem>
                  <SelectItem value="5">5 Stars</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Requirements Checkboxes */}
          <div className="space-y-3">
            <Label>Requirements</Label>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requireExamples"
                  checked={filters.requireExamples || false}
                  onCheckedChange={(checked) =>
                    updateFilter("requireExamples", checked === true)
                  }
                />
                <label
                  htmlFor="requireExamples"
                  className="text-sm cursor-pointer"
                >
                  Has Example Dialogues
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requireLorebook"
                  checked={filters.requireLorebook || false}
                  onCheckedChange={(checked) =>
                    updateFilter("requireLorebook", checked === true)
                  }
                />
                <label
                  htmlFor="requireLorebook"
                  className="text-sm cursor-pointer"
                >
                  Has Lorebook
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requireGreetings"
                  checked={filters.requireGreetings || false}
                  onCheckedChange={(checked) =>
                    updateFilter("requireGreetings", checked === true)
                  }
                />
                <label
                  htmlFor="requireGreetings"
                  className="text-sm cursor-pointer"
                >
                  Has Alternate Greetings
                </label>
              </div>

              {showCTFilters && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isOriginal"
                    checked={filters.isOriginal || false}
                    onCheckedChange={(checked) =>
                      updateFilter("isOriginal", checked === true)
                    }
                  />
                  <label
                    htmlFor="isOriginal"
                    className="text-sm cursor-pointer"
                  >
                    Original Character
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Apply Button */}
          <div className="flex justify-end pt-2">
            <Button onClick={onApply}>Apply Filters</Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
