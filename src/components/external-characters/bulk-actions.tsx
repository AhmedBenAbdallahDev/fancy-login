"use client";

import { useState, useCallback } from "react";
import { Button } from "ui/button";
import {
  CheckSquare,
  Square,
  Download,
  X,
  CheckCheck,
  Loader2,
} from "lucide-react";
import type { ExternalCharacterCard } from "app-types/external-character";
import { cn } from "lib/utils";
import { toast } from "sonner";

interface BulkActionsProps {
  cards: ExternalCharacterCard[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  isEnabled: boolean;
  onToggleEnabled: () => void;
  onImport: (cards: ExternalCharacterCard[]) => Promise<void>;
}

export function BulkActions({
  cards,
  selectedIds,
  onSelectionChange,
  isEnabled,
  onToggleEnabled,
  onImport,
}: BulkActionsProps) {
  const [isImporting, setIsImporting] = useState(false);

  const selectedCards = cards.filter((c) =>
    selectedIds.has(`${c.source}-${c.id}`),
  );

  const handleSelectAll = useCallback(() => {
    const allIds = new Set(cards.map((c) => `${c.source}-${c.id}`));
    onSelectionChange(allIds);
  }, [cards, onSelectionChange]);

  const handleDeselectAll = useCallback(() => {
    onSelectionChange(new Set());
  }, [onSelectionChange]);

  const handleImportSelected = useCallback(async () => {
    if (selectedCards.length === 0) return;

    setIsImporting(true);
    try {
      await onImport(selectedCards);
      toast.success(`Imported ${selectedCards.length} characters`);
      onSelectionChange(new Set());
    } catch (error) {
      toast.error("Failed to import some characters");
      console.error("[Bulk Import] Error:", error);
    } finally {
      setIsImporting(false);
    }
  }, [selectedCards, onImport, onSelectionChange]);

  return (
    <div className="flex items-center gap-2">
      {/* Toggle Button */}
      <Button
        variant={isEnabled ? "default" : "outline"}
        size="sm"
        onClick={onToggleEnabled}
        className="gap-2"
      >
        <CheckCheck className="size-4" />
        <span className="hidden sm:inline">Multi-Select</span>
      </Button>

      {/* Bulk Action Bar - Only visible when enabled */}
      {isEnabled && (
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted animate-in fade-in slide-in-from-left-2",
          )}
        >
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>

          <div className="h-4 w-px bg-border" />

          <Button
            variant="ghost"
            size="sm"
            onClick={handleSelectAll}
            className="h-7 px-2"
          >
            <CheckSquare className="size-3.5 mr-1" />
            All
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeselectAll}
            className="h-7 px-2"
            disabled={selectedIds.size === 0}
          >
            <Square className="size-3.5 mr-1" />
            None
          </Button>

          <div className="h-4 w-px bg-border" />

          <Button
            variant="default"
            size="sm"
            onClick={handleImportSelected}
            disabled={selectedIds.size === 0 || isImporting}
            className="h-7"
          >
            {isImporting ? (
              <>
                <Loader2 className="size-3.5 mr-1 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Download className="size-3.5 mr-1" />
                Import ({selectedIds.size})
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleEnabled}
            className="h-7 w-7 p-0"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

interface SelectableCardOverlayProps {
  isSelected: boolean;
  isEnabled: boolean;
  onToggle: () => void;
}

export function SelectableCardOverlay({
  isSelected,
  isEnabled,
  onToggle,
}: SelectableCardOverlayProps) {
  if (!isEnabled) return null;

  return (
    <button
      className={cn(
        "absolute inset-0 z-10 flex items-start justify-start p-2 transition-colors",
        isSelected ? "bg-primary/20" : "bg-transparent hover:bg-primary/10",
      )}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <div
        className={cn(
          "size-6 rounded-md border-2 flex items-center justify-center transition-colors",
          isSelected
            ? "bg-primary border-primary text-primary-foreground"
            : "bg-background/80 border-muted-foreground/30",
        )}
      >
        {isSelected && <CheckSquare className="size-4" />}
      </div>
    </button>
  );
}
