"use client";

import { useState, useCallback } from "react";
import type {
  LorebookEntry,
  CharacterBook,
} from "app-types/external-character";
import { Button } from "ui/button";
import { Input } from "ui/input";
import { Textarea } from "ui/textarea";
import { Label } from "ui/label";
import { Badge } from "ui/badge";
import { Switch } from "ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "ui/card";
import { ScrollArea } from "ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "ui/dropdown-menu";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Copy,
  MoreHorizontal,
  BookOpen,
  Key,
  Sparkles,
  GripVertical,
  Save,
} from "lucide-react";
import { cn } from "lib/utils";
import { toast } from "sonner";

interface LorebookEditorProps {
  lorebook?: CharacterBook;
  onChange?: (lorebook: CharacterBook) => void;
  readOnly?: boolean;
}

function createEmptyEntry(id: number): LorebookEntry {
  return {
    id,
    keys: [],
    secondaryKeys: [],
    content: "",
    name: `New Entry ${id}`,
    comment: "",
    enabled: true,
    insertionOrder: 100,
    priority: 10,
    position: "before_char",
    constant: false,
    selective: true,
    selectiveLogic: 0,
    probability: 100,
    useProbability: true,
    depth: 4,
    group: "",
    caseSensitive: false,
    matchWholeWords: false,
  };
}

export function LorebookEditor({
  lorebook,
  onChange,
  readOnly = false,
}: LorebookEditorProps) {
  const [expandedEntries, setExpandedEntries] = useState<Set<number>>(
    new Set(),
  );
  const [editingEntry, setEditingEntry] = useState<LorebookEntry | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const entries = lorebook?.entries || [];

  const toggleEntry = (id: number) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const addEntry = useCallback(() => {
    if (!onChange || readOnly) return;

    const newId =
      entries.length > 0 ? Math.max(...entries.map((e) => e.id)) + 1 : 1;
    const newEntry = createEmptyEntry(newId);

    onChange({
      ...lorebook,
      name: lorebook?.name || "Lorebook",
      entries: [...entries, newEntry],
    });

    // Auto-expand new entry
    setExpandedEntries((prev) => new Set([...prev, newId]));
    toast.success("Added new lorebook entry");
  }, [entries, lorebook, onChange, readOnly]);

  const deleteEntry = useCallback(
    (id: number) => {
      if (!onChange || readOnly) return;

      onChange({
        ...lorebook,
        name: lorebook?.name || "Lorebook",
        entries: entries.filter((e) => e.id !== id),
      });

      toast.success("Deleted lorebook entry");
    },
    [entries, lorebook, onChange, readOnly],
  );

  const duplicateEntry = useCallback(
    (entry: LorebookEntry) => {
      if (!onChange || readOnly) return;

      const newId = Math.max(...entries.map((e) => e.id)) + 1;
      const duplicated: LorebookEntry = {
        ...entry,
        id: newId,
        name: `${entry.name} (copy)`,
      };

      onChange({
        ...lorebook,
        name: lorebook?.name || "Lorebook",
        entries: [...entries, duplicated],
      });

      setExpandedEntries((prev) => new Set([...prev, newId]));
      toast.success("Duplicated entry");
    },
    [entries, lorebook, onChange, readOnly],
  );

  const toggleEntryEnabled = useCallback(
    (id: number) => {
      if (!onChange || readOnly) return;

      onChange({
        ...lorebook,
        name: lorebook?.name || "Lorebook",
        entries: entries.map((e) =>
          e.id === id ? { ...e, enabled: !e.enabled } : e,
        ),
      });
    },
    [entries, lorebook, onChange, readOnly],
  );

  const updateEntry = useCallback(
    (id: number, updates: Partial<LorebookEntry>) => {
      if (!onChange || readOnly) return;

      onChange({
        ...lorebook,
        name: lorebook?.name || "Lorebook",
        entries: entries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
      });
    },
    [entries, lorebook, onChange, readOnly],
  );

  const openEditModal = (entry: LorebookEntry) => {
    setEditingEntry({ ...entry });
    setIsEditModalOpen(true);
  };

  const saveEditedEntry = () => {
    if (!editingEntry || !onChange || readOnly) return;

    onChange({
      ...lorebook,
      name: lorebook?.name || "Lorebook",
      entries: entries.map((e) =>
        e.id === editingEntry.id ? editingEntry : e,
      ),
    });

    setIsEditModalOpen(false);
    setEditingEntry(null);
    toast.success("Entry updated");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="size-5" />
            Lorebook
            {entries.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {entries.length} {entries.length === 1 ? "entry" : "entries"}
              </Badge>
            )}
          </CardTitle>
          {!readOnly && (
            <Button size="sm" onClick={addEntry}>
              <Plus className="size-4 mr-1" />
              Add Entry
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <BookOpen className="size-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground mb-3">
              No lorebook entries yet.
            </p>
            {!readOnly && (
              <Button variant="outline" size="sm" onClick={addEntry}>
                <Plus className="size-4 mr-1" />
                Add First Entry
              </Button>
            )}
          </div>
        ) : (
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-2">
              {entries.map((entry) => (
                <LorebookEntryCard
                  key={entry.id}
                  entry={entry}
                  isExpanded={expandedEntries.has(entry.id)}
                  onToggle={() => toggleEntry(entry.id)}
                  onToggleEnabled={() => toggleEntryEnabled(entry.id)}
                  onEdit={() => openEditModal(entry)}
                  onDelete={() => deleteEntry(entry.id)}
                  onDuplicate={() => duplicateEntry(entry)}
                  onUpdate={(updates) => updateEntry(entry.id, updates)}
                  readOnly={readOnly}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Edit Lorebook Entry</DialogTitle>
            <DialogDescription>
              Configure entry keys, content, and activation settings.
            </DialogDescription>
          </DialogHeader>

          {editingEntry && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                {/* Name */}
                <div className="space-y-2">
                  <Label>Entry Name</Label>
                  <Input
                    value={editingEntry.name || ""}
                    onChange={(e) =>
                      setEditingEntry({ ...editingEntry, name: e.target.value })
                    }
                    placeholder="Entry name..."
                  />
                </div>

                {/* Keys */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Key className="size-4" />
                    Trigger Keys (comma-separated)
                  </Label>
                  <Input
                    value={editingEntry.keys.join(", ")}
                    onChange={(e) =>
                      setEditingEntry({
                        ...editingEntry,
                        keys: e.target.value
                          .split(",")
                          .map((k) => k.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="keyword1, keyword2, phrase..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Entry activates when any of these keys appear in the chat.
                  </p>
                </div>

                {/* Content */}
                <div className="space-y-2">
                  <Label>Content</Label>
                  <Textarea
                    value={editingEntry.content}
                    onChange={(e) =>
                      setEditingEntry({
                        ...editingEntry,
                        content: e.target.value,
                      })
                    }
                    placeholder="Lorebook content..."
                    rows={6}
                    className="font-mono text-sm"
                  />
                </div>

                {/* Settings Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <Label>Enabled</Label>
                    <Switch
                      checked={editingEntry.enabled}
                      onCheckedChange={(checked) =>
                        setEditingEntry({ ...editingEntry, enabled: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Constant</Label>
                    <Switch
                      checked={editingEntry.constant}
                      onCheckedChange={(checked) =>
                        setEditingEntry({ ...editingEntry, constant: checked })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Insertion Order</Label>
                    <Input
                      type="number"
                      value={editingEntry.insertionOrder}
                      onChange={(e) =>
                        setEditingEntry({
                          ...editingEntry,
                          insertionOrder: parseInt(e.target.value) || 100,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Depth</Label>
                    <Input
                      type="number"
                      value={editingEntry.depth || 4}
                      onChange={(e) =>
                        setEditingEntry({
                          ...editingEntry,
                          depth: parseInt(e.target.value) || 4,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEditedEntry}>
              <Save className="size-4 mr-1" />
              Save Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

interface LorebookEntryCardProps {
  entry: LorebookEntry;
  isExpanded: boolean;
  onToggle: () => void;
  onToggleEnabled: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onUpdate: (updates: Partial<LorebookEntry>) => void;
  readOnly?: boolean;
}

function LorebookEntryCard({
  entry,
  isExpanded,
  onToggle,
  onToggleEnabled,
  onEdit,
  onDelete,
  onDuplicate,
  readOnly = false,
}: LorebookEntryCardProps) {
  return (
    <div
      className={cn(
        "border rounded-lg transition-colors",
        !entry.enabled && "opacity-60 bg-muted/30",
      )}
    >
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <div className="flex items-center gap-2 p-3">
          {!readOnly && (
            <GripVertical className="size-4 text-muted-foreground/50 cursor-grab" />
          )}

          <CollapsibleTrigger className="flex items-center gap-2 flex-1 min-w-0">
            {isExpanded ? (
              <ChevronDown className="size-4 flex-shrink-0" />
            ) : (
              <ChevronRight className="size-4 flex-shrink-0" />
            )}
            <span className="font-medium truncate">
              {entry.name || `Entry ${entry.id}`}
            </span>
          </CollapsibleTrigger>

          {/* Keys Preview */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {entry.keys.slice(0, 2).map((key, i) => (
              <Badge key={i} variant="outline" className="text-[10px] px-1.5">
                {key}
              </Badge>
            ))}
            {entry.keys.length > 2 && (
              <Badge variant="outline" className="text-[10px] px-1.5">
                +{entry.keys.length - 2}
              </Badge>
            )}
          </div>

          {/* Status */}
          <Badge
            variant={entry.enabled ? "default" : "secondary"}
            className={cn(
              "text-[10px] flex-shrink-0",
              entry.constant && "bg-amber-500/80",
            )}
          >
            {entry.constant
              ? "Constant"
              : entry.enabled
                ? "Active"
                : "Disabled"}
          </Badge>

          {/* Actions */}
          {!readOnly && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Sparkles className="size-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onToggleEnabled}>
                  <Switch className="size-4 mr-2" checked={entry.enabled} />
                  {entry.enabled ? "Disable" : "Enable"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicate}>
                  <Copy className="size-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive"
                >
                  <Trash2 className="size-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0 space-y-2 border-t bg-muted/30">
            {/* Keys */}
            <div className="pt-2">
              <Label className="text-xs text-muted-foreground">Keys</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {entry.keys.map((key, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {key}
                  </Badge>
                ))}
                {entry.keys.length === 0 && (
                  <span className="text-xs text-muted-foreground italic">
                    No keys defined
                  </span>
                )}
              </div>
            </div>

            {/* Content Preview */}
            <div>
              <Label className="text-xs text-muted-foreground">Content</Label>
              <p className="text-sm text-muted-foreground line-clamp-3 mt-1 whitespace-pre-wrap font-mono bg-background p-2 rounded border">
                {entry.content || "No content"}
              </p>
            </div>

            {/* Quick Actions */}
            {!readOnly && (
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={onEdit}>
                  Edit Entry
                </Button>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
