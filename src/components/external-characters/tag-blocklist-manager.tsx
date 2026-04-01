"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "ui/button";
import { Input } from "ui/input";
import { Badge } from "ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "ui/card";
import { X, Plus, AlertTriangle, Shield } from "lucide-react";
import { toast } from "sonner";

// Local storage key for blocklist
const BLOCKLIST_KEY = "external-character-tag-blocklist";

// Default blocked tags (user can remove)
const DEFAULT_BLOCKED: string[] = [];

// Common NSFW/sensitive tags that users might want to block
const SUGGESTED_BLOCKS = [
  "NSFW",
  "Gore",
  "Guro",
  "Extreme",
  "Snuff",
  "Loli",
  "Shota",
  "Underage",
  "Rape",
  "Non-con",
  "Scat",
  "Vore",
  "Incest",
  "Bestiality",
];

interface TagBlocklistManagerProps {
  onBlocklistChange?: (blocklist: string[]) => void;
}

export function TagBlocklistManager({
  onBlocklistChange,
}: TagBlocklistManagerProps) {
  const [blocklist, setBlocklist] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  // Load blocklist from local storage
  useEffect(() => {
    const stored = localStorage.getItem(BLOCKLIST_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setBlocklist(parsed);
        }
      } catch {
        // Use default
        setBlocklist(DEFAULT_BLOCKED);
      }
    } else {
      setBlocklist(DEFAULT_BLOCKED);
    }
    setIsLoaded(true);
  }, []);

  // Save blocklist to local storage and notify parent
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(BLOCKLIST_KEY, JSON.stringify(blocklist));
      onBlocklistChange?.(blocklist);
    }
  }, [blocklist, isLoaded, onBlocklistChange]);

  const addTag = useCallback((tag: string) => {
    const normalized = tag.trim().toLowerCase();
    if (!normalized) return;

    setBlocklist((prev) => {
      if (prev.some((t) => t.toLowerCase() === normalized)) {
        toast.error("Tag already blocked");
        return prev;
      }
      toast.success(`Blocked tag: ${tag}`);
      return [...prev, tag.trim()];
    });
    setInputValue("");
  }, []);

  const removeTag = useCallback((tag: string) => {
    setBlocklist((prev) => prev.filter((t) => t !== tag));
    toast.success(`Unblocked tag: ${tag}`);
  }, []);

  const addSuggested = useCallback(
    (tag: string) => {
      if (!blocklist.some((t) => t.toLowerCase() === tag.toLowerCase())) {
        setBlocklist((prev) => [...prev, tag]);
        toast.success(`Blocked tag: ${tag}`);
      }
    },
    [blocklist],
  );

  const clearAll = useCallback(() => {
    setBlocklist([]);
    toast.success("Cleared all blocked tags");
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addTag(inputValue);
  };

  const suggestedNotBlocked = SUGGESTED_BLOCKS.filter(
    (tag) => !blocklist.some((b) => b.toLowerCase() === tag.toLowerCase()),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="size-5" />
          Tag Blocklist
        </CardTitle>
        <CardDescription>
          Block specific tags from appearing in external character searches.
          Characters with these tags will be hidden.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Tag Form */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            placeholder="Enter tag to block..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={!inputValue.trim()}>
            <Plus className="size-4 mr-1" />
            Block
          </Button>
        </form>

        {/* Current Blocklist */}
        {blocklist.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                Blocked Tags ({blocklist.length})
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="text-xs h-7"
              >
                Clear All
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {blocklist.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="pl-2 pr-1 py-1 gap-1 cursor-pointer hover:bg-destructive/20"
                  onClick={() => removeTag(tag)}
                >
                  <AlertTriangle className="size-3 text-destructive" />
                  {tag}
                  <X className="size-3 ml-1" />
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Suggested Tags */}
        {suggestedNotBlocked.length > 0 && (
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">
              Commonly blocked tags:
            </span>
            <div className="flex flex-wrap gap-2">
              {suggestedNotBlocked.map((tag) => (
                <Button
                  key={tag}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => addSuggested(tag)}
                >
                  <Plus className="size-3 mr-1" />
                  {tag}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {blocklist.length === 0 && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            <Shield className="size-8 mx-auto mb-2 opacity-50" />
            <p>No tags blocked. Add tags above to filter them out.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Hook to get the current blocklist from localStorage
 */
export function useTagBlocklist(): string[] {
  const [blocklist, setBlocklist] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(BLOCKLIST_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setBlocklist(parsed);
        }
      } catch {
        setBlocklist([]);
      }
    }

    // Listen for storage changes
    const handleStorage = (e: StorageEvent) => {
      if (e.key === BLOCKLIST_KEY) {
        try {
          const parsed = JSON.parse(e.newValue || "[]");
          if (Array.isArray(parsed)) {
            setBlocklist(parsed);
          }
        } catch {
          setBlocklist([]);
        }
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return blocklist;
}

/**
 * Get blocklist from localStorage (synchronous, for server components)
 */
export function getStoredBlocklist(): string[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(BLOCKLIST_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
