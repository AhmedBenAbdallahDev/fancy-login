"use client";

import { ChatMentionInputSuggestion } from "@/components/chat-mention-input";
import { DefaultToolIcon } from "@/components/default-tool-icon";
import { useMcpList } from "@/hooks/queries/use-mcp-list";
import { useWorkflowToolList } from "@/hooks/queries/use-workflow-tool-list";
import { useObjectState } from "@/hooks/use-object-state";
import {
  Character,
  CharacterCreateSchema,
  CharacterGenerateSchema,
} from "app-types/character";
import { ChatMention, ChatModel } from "app-types/chat";
import { DefaultToolName } from "lib/ai/tools";
import equal from "lib/equal";
import { cn, fetcher, noop, objectFlow } from "lib/utils";
import {
  ChevronDownIcon,
  CommandIcon,
  CornerRightUpIcon,
  HammerIcon,
  Loader,
  WandSparklesIcon,
  XIcon,
  Globe,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "ui/avatar";
import { Button } from "ui/button";
import { Input } from "ui/input";
import { Label } from "ui/label";
import { MCPIcon } from "ui/mcp-icon";

import { ScrollArea } from "ui/scroll-area";
import { Textarea } from "ui/textarea";
import useSWR, { mutate } from "swr";
import { Skeleton } from "ui/skeleton";
import { Switch } from "ui/switch";
import { handleErrorWithToast } from "ui/shared-toast";
import { appStore } from "@/app/store";

import { experimental_useObject } from "@ai-sdk/react";
import { MCPServerInfo } from "app-types/mcp";
import { WorkflowSummary } from "app-types/workflow";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "ui/dialog";
import { SelectModel } from "@/components/select-model";

import { MessageLoading } from "ui/message-loading";
import { TextShimmer } from "ui/text-shimmer";
import { toast } from "sonner";
import { BecomeCreatorModal } from "@/components/become-creator-modal";
import { ImageUpload } from "ui/image-upload";

// Helper to convert tool names to ChatMention objects
const toolNamesToMentions = (
  toolNames: string[],
  mcpList: any[],
  workflowToolList: any[],
): ChatMention[] => {
  const mentions: ChatMention[] = [];

  objectFlow(DefaultToolName).forEach((toolName) => {
    if (toolNames.includes(toolName)) {
      mentions.push({
        type: "defaultTool",
        name: toolName,
        label: toolName,
      });
    }
  });

  (mcpList as (MCPServerInfo & { id: string })[]).forEach((mcp) => {
    mcp.toolInfo.forEach((tool) => {
      if (toolNames.includes(tool.name)) {
        mentions.push({
          type: "mcpTool",
          serverName: mcp.name,
          name: tool.name,
          serverId: mcp.id,
        });
      }
    });
  });

  (workflowToolList as WorkflowSummary[]).forEach((workflow) => {
    if (toolNames.includes(workflow.name)) {
      mentions.push({
        type: "workflow",
        name: workflow.name,
        workflowId: workflow.id,
      });
    }
  });

  return mentions;
};

// Helper to convert ChatMention objects to tool names
const mentionsToToolNames = (mentions: ChatMention[]): string[] => {
  return mentions.map((m) => m.name);
};

const defaultConfig = (): Partial<Character> & { mentions: ChatMention[] } => {
  return {
    name: "",
    tagline: "",
    description: "",
    avatar: "",
    isPublic: false,
    personality: "",
    systemPrompt: "",
    greeting: "",
    exampleDialogue: "",
    tags: [],
    allowedTools: [],
    mentions: [], // Temporary state for UI
  };
};

export default function EditCharacter({ id }: { id?: string }) {
  const t = useTranslations();
  const [openGenerateDialog, setOpenGenerateDialog] = useState(false);
  const [generateModel, setGenerateModel] = useState<ChatModel | undefined>(
    appStore.getState().chatModel,
  );
  const [generatePrompt, setGeneratePrompt] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [showBecomeCreatorModal, setShowBecomeCreatorModal] = useState(false);
  const { data: mcpList, isLoading: isMcpLoading } = useMcpList();
  const { data: workflowToolList, isLoading: isWorkflowLoading } =
    useWorkflowToolList();
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  const {
    object,
    submit,
    isLoading: isGenerating,
  } = experimental_useObject({
    api: "/api/character/ai",
    schema: CharacterGenerateSchema,
    onFinish(event) {
      if (event.error) {
        handleErrorWithToast(event.error);
      }
      if (event.object?.tools) {
        assignToolsByNames(event.object.tools);
      }
    },
  });

  const [open, setOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [character, setCharacter] = useObjectState(defaultConfig());

  const assignToolsByNames = useCallback(
    (toolNames: string[]) => {
      if (!mcpList || !workflowToolList) return;

      const mentions = toolNamesToMentions(
        toolNames,
        mcpList,
        workflowToolList,
      );

      if (mentions.length > 0) {
        setCharacter((_prev) => ({
          mentions,
          allowedTools: toolNames,
        }));
      }
    },
    [mcpList, workflowToolList],
  );

  const {
    isLoading: isStoredCharacterLoading,
    mutate: mutateStoredCharacter,
    isValidating,
  } = useSWR(id ? `/api/character/${id}` : null, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateIfHidden: false,
    onError: (error) => {
      handleErrorWithToast(error);
      router.push(`/characters`);
    },
    onSuccess: (data: Character) => {
      if (data) {
        // Convert allowedTools to mentions for UI
        const mentions = toolNamesToMentions(
          data.allowedTools || [],
          mcpList || [],
          workflowToolList || [],
        );

        setCharacter({
          ...defaultConfig(),
          ...data,
          mentions,
        });
      } else {
        toast.error(`Character not found`);
        router.push(`/characters`);
      }
    },
  });

  // Re-sync mentions when lists load if we have a character loaded
  useEffect(() => {
    if (
      character.allowedTools?.length &&
      character.mentions.length === 0 &&
      mcpList &&
      workflowToolList
    ) {
      const mentions = toolNamesToMentions(
        character.allowedTools,
        mcpList,
        workflowToolList,
      );
      setCharacter({ mentions });
    }
  }, [mcpList, workflowToolList, character.allowedTools]);

  const saveCharacter = useCallback(async () => {
    setIsSaving(true);

    // Prepare data for API (remove UI-only fields)
    const { mentions, ...apiData } = character;

    // Ensure allowedTools is up to date with mentions
    apiData.allowedTools = mentionsToToolNames(mentions);

    try {
      const validData = CharacterCreateSchema.parse(apiData);
      const response = await fetch(
        id ? `/api/character/${id}` : `/api/character`,
        {
          method: id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validData),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        // Check if creator profile is required
        if (result.error === "CREATOR_REQUIRED") {
          setShowBecomeCreatorModal(true);
          return;
        }
        throw new Error(
          result.error || result.message || "Failed to save character",
        );
      }

      mutate(`/api/character`);
      if (id) mutate(`/api/character/${id}`);
      router.push(`/characters`);
      toast.success(id ? "Character updated" : "Character created");
    } catch (error: any) {
      handleErrorWithToast(error);
    } finally {
      setIsSaving(false);
    }
  }, [character, id, router]);

  // Handler for when creator profile is created - retry saving
  const handleCreatorProfileCreated = useCallback(() => {
    setShowBecomeCreatorModal(false);
    // Retry saving now that we have a creator profile
    saveCharacter();
  }, [saveCharacter]);

  const handleOpenAiGenerate = useCallback(async () => {
    setOpenGenerateDialog(true);
    setGeneratePrompt("");
  }, []);

  const triggerRef = useRef<HTMLDivElement>(null);
  const triggerRect = useMemo(() => {
    return triggerRef.current?.getBoundingClientRect();
  }, [open]);

  const handleSelectMention = useCallback(
    (item: { label: string; id: string }) => {
      const mention = JSON.parse(item.id) as ChatMention;
      setCharacter((prev) => {
        const mentions = [...(prev.mentions ?? [])];
        const index = mentions.findIndex((m) => equal(m, mention));
        if (index !== -1) {
          mentions.splice(index, 1);
        } else {
          mentions.push(mention);
        }
        return {
          mentions,
          allowedTools: mentionsToToolNames(mentions),
        };
      });
    },
    [],
  );

  const selectedIds = useMemo(() => {
    return (character.mentions ?? []).map((m) => JSON.stringify(m));
  }, [character.mentions]);

  const handleDeleteMention = useCallback((mention: ChatMention) => {
    setCharacter((prev) => {
      const newMentions =
        prev.mentions?.filter((m) => !equal(m, mention)) || [];
      return {
        mentions: newMentions,
        allowedTools: mentionsToToolNames(newMentions),
      };
    });
  }, []);

  const handleAddTag = useCallback(() => {
    const next = tagInput.trim();
    if (!next) return;
    setCharacter((prev) => {
      const current = prev.tags || [];
      if (current.length >= 10) {
        toast.error("You can add up to 10 tags");
        return prev;
      }
      if (current.find((t) => t.toLowerCase() === next.toLowerCase()))
        return prev;
      return { tags: [...current, next] };
    });
    setTagInput("");
  }, [tagInput]);

  const handleRemoveTag = useCallback((tag: string) => {
    setCharacter((prev) => ({
      tags: (prev.tags || []).filter((t) => t !== tag),
    }));
  }, []);

  const selectedMentions = useMemo(() => {
    return (character.mentions ?? []).map((m, i) => {
      return (
        <div
          key={i}
          className="hover:ring hover:ring-destructive group cursor-pointer text-xs flex items-center gap-1 px-2 py-1 rounded-sm bg-background"
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteMention(m);
          }}
        >
          <div className="p-0.5">
            {m.type == "defaultTool" ? (
              <DefaultToolIcon
                name={m.name as DefaultToolName}
                className="size-3"
              />
            ) : m.type == "mcpServer" ? (
              <MCPIcon className="size-3" />
            ) : m.type == "workflow" ? (
              <Avatar
                style={m.icon?.style}
                className="size-3 ring-[1px] ring-input rounded-full"
              >
                <AvatarImage src={m.icon?.value} />
                <AvatarFallback>{m.name.slice(0, 1)}</AvatarFallback>
              </Avatar>
            ) : (
              <HammerIcon className="size-3" />
            )}
          </div>

          {m.name}

          <span className="ml-2">
            <XIcon className="size-2.5 text-muted-foreground group-hover:text-destructive" />
          </span>
        </div>
      );
    });
  }, [character.mentions]);

  const submitGenerate = useCallback(() => {
    // Reset character to default state before regenerating
    // This prevents validation errors from previous state
    setCharacter(defaultConfig());

    // Small delay to ensure state is reset before submit
    setTimeout(() => {
      submit({
        message: generatePrompt,
        chatModel: generateModel,
      });
    }, 50);

    setOpenGenerateDialog(false);
    setGeneratePrompt("");
  }, [generatePrompt, generateModel]);

  const isLoadingTool = useMemo(() => {
    return isMcpLoading || isWorkflowLoading;
  }, [isMcpLoading, isWorkflowLoading]);

  const isLoading = useMemo(() => {
    return isGenerating || isLoadingTool || isSaving || isValidating;
  }, [isGenerating, isLoadingTool, isSaving, isValidating]);

  useEffect(() => {
    if (!object) return;
    objectFlow(object).forEach((data, key) => {
      setCharacter((prev) => {
        if (key === "name") return { name: data as string };
        if (key === "tagline") return { tagline: data as string };
        if (key === "description") return { description: data as string };
        if (key === "personality") return { personality: data as string };
        if (key === "greeting") return { greeting: data as string };
        if (key === "exampleDialogue")
          return { exampleDialogue: data as string };
        if (key === "systemPrompt") {
          textareaRef.current?.scrollTo({
            top: textareaRef.current?.scrollHeight,
          });
          return { systemPrompt: data as string };
        }
        return prev;
      });
    });
  }, [object]);

  useEffect(() => {
    if (id && !isValidating) {
      mutateStoredCharacter();
    } else if (!id) {
      setCharacter(defaultConfig());
    }
  }, [id]);

  return (
    <ScrollArea className="h-full w-full relative">
      <div className="w-full h-8 absolute bottom-0 left-0 bg-gradient-to-t from-background to-transparent z-20 pointer-events-none" />
      <div className="z-10 relative flex flex-col gap-4 px-8 pt-8 pb-14  max-w-3xl h-full mx-auto">
        <div className="sticky top-0 bg-background z-10 flex items-center justify-between pb-4 gap-2">
          <div className="w-full h-8 absolute top-[100%] left-0 bg-gradient-to-b from-background to-transparent z-20 pointer-events-none" />
          {isGenerating ? (
            <TextShimmer className="w-full text-2xl font-bold ">
              {t("CharacterEditor.generating")}
            </TextShimmer>
          ) : (
            <p className="w-full text-2xl font-bold ">
              {id
                ? t("CharacterEditor.editTitle")
                : t("CharacterEditor.createTitle")}
            </p>
          )}

          <Button
            variant={"ghost"}
            className="ml-auto"
            disabled={isLoading}
            onClick={handleOpenAiGenerate}
          >
            <WandSparklesIcon className="size-3" />
            {t("Common.generateWithAI")}
            {isGenerating && <Loader className="size-3 animate-spin" />}
          </Button>
        </div>

        {/* Basic Info */}
        <div className="flex gap-4 mt-4">
          <div className="flex flex-col justify-between gap-2 flex-1">
            <Label htmlFor="character-name">
              {t("CharacterEditor.nameLabel")}
            </Label>
            {isStoredCharacterLoading ? (
              <Skeleton className="w-full h-10" />
            ) : (
              <Input
                value={character.name || ""}
                onChange={(e) => setCharacter({ name: e.target.value })}
                autoFocus
                disabled={isLoading}
                className="hover:bg-input bg-secondary/40 transition-colors border-transparent border-none! focus-visible:bg-input! ring-0!"
                id="character-name"
                placeholder={t("CharacterEditor.namePlaceholder")}
              />
            )}
          </div>

          {/* Avatar Picker */}
          {isStoredCharacterLoading ? (
            <Skeleton className="w-16 h-16" />
          ) : (
            <div className="w-24">
              <ImageUpload
                value={character.avatar}
                onChange={(url) => setCharacter({ avatar: url || "" })}
                folder="characters/avatars"
                maxWidth={512}
                maxHeight={512}
                aspectRatio="square"
                placeholder="Upload avatar"
                disabled={isLoading}
              />
            </div>
          )}
        </div>

        {/* Visibility priority */}
        <div className="flex flex-col gap-3 rounded-xl border bg-secondary/50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Globe className="size-4" />
            <span>
              {character.isPublic
                ? t("CharacterEditor.publicCharacter")
                : t("CharacterEditor.privateCharacter")}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {character.isPublic
                ? (t("CharacterEditor.publicHelp") ??
                  "Listed in Discover and shareable")
                : (t("CharacterEditor.privateHelp") ?? "Visible only to you")}
            </p>
            <div className="flex items-center gap-2">
              <Switch
                id="character-visibility-priority"
                checked={character.isPublic ?? false}
                onCheckedChange={(checked) =>
                  setCharacter({ isPublic: checked })
                }
                disabled={isLoading}
              />
              <Label
                htmlFor="character-visibility-priority"
                className="text-sm"
              >
                {character.isPublic
                  ? t("CharacterEditor.publicCharacter")
                  : t("CharacterEditor.privateCharacter")}
              </Label>
            </div>
          </div>
        </div>

        {/* Tagline */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="character-tagline">
            {t("CharacterEditor.taglineLabel")}
          </Label>
          {isStoredCharacterLoading ? (
            <Skeleton className="w-full h-10" />
          ) : (
            <Input
              id="character-tagline"
              disabled={isLoading}
              placeholder={t("CharacterEditor.taglinePlaceholder")}
              className="hover:bg-input placeholder:text-xs bg-secondary/40 transition-colors border-transparent border-none! focus-visible:bg-input! ring-0!"
              value={character.tagline || ""}
              onChange={(e) => setCharacter({ tagline: e.target.value })}
            />
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="character-tags">Tags (optional, max 10)</Label>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              {(character.tags || []).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs hover:bg-primary/20"
                >
                  <span>#{tag}</span>
                  <XIcon className="size-3" />
                </button>
              ))}
              {(character.tags || []).length === 0 && (
                <span className="text-xs text-muted-foreground">
                  Add keywords so others can find this character
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                id="character-tags"
                placeholder="Add a tag and press Enter"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                disabled={isLoading}
              />
              <Button
                variant="secondary"
                onClick={handleAddTag}
                disabled={!tagInput.trim() || isLoading}
              >
                Add
              </Button>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="character-description">
            {t("CharacterEditor.descriptionLabel")}
          </Label>
          {isStoredCharacterLoading ? (
            <Skeleton className="w-full h-24" />
          ) : (
            <Textarea
              id="character-description"
              disabled={isLoading}
              placeholder={t("CharacterEditor.descriptionPlaceholder")}
              className="p-4 hover:bg-input min-h-24 max-h-48 overflow-y-auto resize-none placeholder:text-xs bg-secondary/40 transition-colors border-transparent border-none! focus-visible:bg-input! ring-0!"
              value={character.description || ""}
              onChange={(e) => setCharacter({ description: e.target.value })}
            />
          )}
        </div>

        <div className="mt-6 flex items-center gap-2 border-t pt-6">
          <span className="text-lg">🎭</span>
          <h3 className="text-lg font-medium">
            {t("CharacterEditor.roleplaySettingsTitle")}
          </h3>
        </div>

        {/* Personality */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="character-personality">
            {t("CharacterEditor.personalityLabel")}
          </Label>
          {isStoredCharacterLoading ? (
            <Skeleton className="w-full h-24" />
          ) : (
            <Textarea
              id="character-personality"
              disabled={isLoading}
              placeholder={t("CharacterEditor.personalityPlaceholder")}
              className="p-4 hover:bg-input min-h-24 max-h-48 overflow-y-auto resize-none placeholder:text-xs bg-secondary/40 transition-colors border-transparent border-none! focus-visible:bg-input! ring-0!"
              value={character.personality || ""}
              onChange={(e) => setCharacter({ personality: e.target.value })}
            />
          )}
        </div>

        {/* Greeting */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="character-greeting">
            {t("CharacterEditor.greetingLabel")}
          </Label>
          {isStoredCharacterLoading ? (
            <Skeleton className="w-full h-24" />
          ) : (
            <Textarea
              id="character-greeting"
              disabled={isLoading}
              placeholder={t("CharacterEditor.greetingPlaceholder")}
              className="p-4 hover:bg-input min-h-24 max-h-48 overflow-y-auto resize-none placeholder:text-xs bg-secondary/40 transition-colors border-transparent border-none! focus-visible:bg-input! ring-0!"
              value={character.greeting || ""}
              onChange={(e) => setCharacter({ greeting: e.target.value })}
            />
          )}
        </div>

        {/* Example Dialogue */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="character-example-dialogue">
            {t("CharacterEditor.exampleDialogueLabel")}
          </Label>
          {isStoredCharacterLoading ? (
            <Skeleton className="w-full h-32" />
          ) : (
            <Textarea
              id="character-example-dialogue"
              disabled={isLoading}
              placeholder={t("CharacterEditor.exampleDialoguePlaceholder")}
              className="p-4 hover:bg-input min-h-32 max-h-64 overflow-y-auto resize-none placeholder:text-xs bg-secondary/40 transition-colors border-transparent border-none! focus-visible:bg-input! ring-0!"
              value={character.exampleDialogue || ""}
              onChange={(e) =>
                setCharacter({ exampleDialogue: e.target.value })
              }
            />
          )}
        </div>

        <div className="mt-6 flex items-center gap-2 border-t pt-6">
          <span className="text-lg">🤖</span>
          <h3 className="text-lg font-medium">
            {t("CharacterEditor.advancedSettingsTitle")}
          </h3>
        </div>

        {/* System Prompt */}
        <div className="flex gap-2 flex-col">
          <Label htmlFor="character-prompt" className="text-base">
            {t("CharacterEditor.systemPromptLabel")}
          </Label>
          {isStoredCharacterLoading ? (
            <Skeleton className="w-full h-48" />
          ) : (
            <Textarea
              id="character-prompt"
              ref={textareaRef}
              disabled={isLoading}
              placeholder={t("CharacterEditor.systemPromptPlaceholder")}
              className="p-6 hover:bg-input min-h-48 max-h-96 overflow-y-auto resize-none placeholder:text-xs bg-secondary/40 transition-colors border-transparent border-none! focus-visible:bg-input! ring-0!"
              value={character.systemPrompt || ""}
              onChange={(e) => setCharacter({ systemPrompt: e.target.value })}
            />
          )}
        </div>

        {/* Tools */}
        <div className="flex gap-2 flex-col">
          <Label htmlFor="character-tool-bindings" className="text-base">
            {t("CharacterEditor.allowedToolsLabel")}
          </Label>
          {isStoredCharacterLoading ? (
            <Skeleton className="w-full h-12" />
          ) : (
            <ChatMentionInputSuggestion
              onSelectMention={handleSelectMention}
              onClose={noop}
              open={open}
              disabledType={["agent"]}
              onOpenChange={setOpen}
              top={0}
              left={0}
              selectedIds={selectedIds}
              style={{
                width: triggerRect?.width ?? 0,
              }}
            >
              <div
                className="hover:bg-input w-full justify-start flex items-center gap-2 cursor-pointer px-3 py-4 rounded-md bg-secondary"
                ref={triggerRef}
              >
                <div className="flex gap-2 items-center flex-wrap mr-auto">
                  {isLoadingTool ? (
                    <span className="text-sm text-muted-foreground">
                      {t("CharacterEditor.loadingTools")}
                    </span>
                  ) : selectedMentions.length == 0 ? (
                    <span className="text-sm text-muted-foreground">
                      {t("CharacterEditor.addTools")}
                    </span>
                  ) : (
                    selectedMentions
                  )}
                </div>
                {isLoadingTool ? (
                  <Loader className="size-4 animate-spin" />
                ) : (
                  <ChevronDownIcon
                    className={cn(
                      "size-4 transition-transform",
                      open && "rotate-180",
                    )}
                  />
                )}
              </div>
            </ChatMentionInputSuggestion>
          )}
        </div>

        <div
          className={cn(
            "flex justify-end items-center mt-8",
            isStoredCharacterLoading && "hidden",
          )}
        >
          <Button className="" onClick={saveCharacter} disabled={isLoading}>
            {isSaving ? t("Common.saving") : t("Common.save")}
            {isSaving && <Loader className="size-4 animate-spin" />}
          </Button>
        </div>
      </div>

      {/* AI Generation Dialog */}
      <Dialog open={openGenerateDialog} onOpenChange={setOpenGenerateDialog}>
        <DialogContent className="xl:max-w-[40vw] w-full max-w-full">
          <DialogHeader>
            <DialogTitle>
              {t("CharacterEditor.generateDialogTitle")}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t("CharacterEditor.generateDialogTitle")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-6 w-full">
            <div className="px-4">
              <p className="bg-secondary rounded-lg max-w-2/3 p-4">
                {t("CharacterEditor.generateDialogDescription")}
              </p>
            </div>

            <div className="flex justify-end px-4">
              <p
                className={cn(
                  "text-sm bg-primary text-primary-foreground py-4 px-6 rounded-lg",
                )}
              >
                <MessageLoading className="size-4" />
              </p>
            </div>

            <div className="relative flex flex-col border rounded-lg p-4">
              <Textarea
                value={generatePrompt}
                autoFocus
                placeholder={t("CharacterEditor.generatePromptPlaceholder")}
                onChange={(e) => setGeneratePrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.metaKey) {
                    e.preventDefault();
                    submitGenerate();
                  }
                }}
                className="w-full break-all pb-6 border-none! ring-0! resize-none min-h-24 max-h-48 overflow-y-auto placeholder:text-xs transition-colors"
              />
              <div className="flex justify-end items-center gap-2">
                <SelectModel
                  showProvider
                  onSelect={(model) => setGenerateModel(model)}
                />
                <Button
                  disabled={!generatePrompt.trim()}
                  size={"sm"}
                  onClick={() => {
                    submitGenerate();
                  }}
                  className="text-xs"
                >
                  <span className="mr-1">{t("Common.generate")}</span>
                  <CommandIcon className="size-3" />
                  <CornerRightUpIcon className="size-3" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Become Creator Modal */}
      <BecomeCreatorModal
        open={showBecomeCreatorModal}
        onOpenChange={setShowBecomeCreatorModal}
        onSuccess={handleCreatorProfileCreated}
      />
    </ScrollArea>
  );
}
