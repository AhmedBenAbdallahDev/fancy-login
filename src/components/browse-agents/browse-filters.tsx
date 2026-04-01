"use client";
import { Input } from "ui/input";
import { Search, Filter } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "ui/dropdown-menu";
import { Button } from "ui/button";
import { useTranslations } from "next-intl";

interface BrowseFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: "newest" | "oldest" | "name" | "popular";
  onSortChange: (sort: "newest" | "oldest" | "name" | "popular") => void;
}

export function BrowseFilters({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
}: BrowseFiltersProps) {
  const t = useTranslations();

  const sortOptions = [
    { value: "newest" as const, label: t("Agent.sortNewest") },
    { value: "popular" as const, label: t("Agent.sortPopular") },
    { value: "oldest" as const, label: t("Agent.sortOldest") },
    { value: "name" as const, label: t("Agent.sortName") },
  ];

  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder={t("Agent.searchAgents")}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Filter className="size-4" />
            Sort: {sortOptions.find(opt => opt.value === sortBy)?.label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {sortOptions.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onSortChange(option.value)}
              className={sortBy === option.value ? "bg-accent" : ""}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
