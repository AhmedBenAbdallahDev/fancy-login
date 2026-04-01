"use client";

import { Input } from "ui/input";
import { Button } from "ui/button";
import { Search, X, TrendingUp, Clock, Flame, EyeOff } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "ui/dropdown-menu";
import { Switch } from "ui/switch";
import { Label } from "ui/label";
import { cn } from "lib/utils";

interface ExternalCharacterSearchProps {
  value: string;
  onChange: (value: string) => void;
  sortBy: "popular" | "newest" | "trending";
  onSortChange: (sort: "popular" | "newest" | "trending") => void;
  hideNsfw?: boolean;
  onHideNsfwChange?: (hide: boolean) => void;
}

const SORT_OPTIONS = [
  { value: "popular" as const, label: "Popular", icon: TrendingUp },
  { value: "newest" as const, label: "Newest", icon: Clock },
  { value: "trending" as const, label: "Trending", icon: Flame },
];

export function ExternalCharacterSearch({
  value,
  onChange,
  sortBy,
  onSortChange,
  hideNsfw = false,
  onHideNsfwChange,
}: ExternalCharacterSearchProps) {
  const currentSort = SORT_OPTIONS.find((s) => s.value === sortBy);

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      {/* Search Input */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search characters..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-9 pr-9 h-10 rounded-lg bg-muted/30 border-0"
        />
        {value && (
          <button
            onClick={() => onChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Sort Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="h-10 min-w-[120px] justify-start gap-2"
          >
            {currentSort && <currentSort.icon className="size-4" />}
            {currentSort?.label || "Sort"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {SORT_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onSortChange(option.value)}
              className={cn(sortBy === option.value && "bg-accent")}
            >
              <option.icon className="size-4 mr-2" />
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* NSFW Toggle */}
      {onHideNsfwChange && (
        <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-muted/30">
          <EyeOff className="size-4 text-muted-foreground" />
          <Label htmlFor="hide-nsfw" className="text-sm cursor-pointer">
            Hide NSFW
          </Label>
          <Switch
            id="hide-nsfw"
            checked={hideNsfw}
            onCheckedChange={onHideNsfwChange}
          />
        </div>
      )}
    </div>
  );
}
