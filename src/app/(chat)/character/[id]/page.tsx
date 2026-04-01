"use client";

import { use, useState, useCallback } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { fetcher, generateUUID } from "lib/utils";
import { Character, CharacterComment } from "app-types/character";
import { Persona } from "app-types/persona";
import { StylePreset, DEFAULT_STYLE_PRESETS } from "app-types/style-preset";
import { ChatThread } from "app-types/chat";
import { Button } from "ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "ui/avatar";
import { Badge } from "ui/badge";
import { ScrollArea } from "ui/scroll-area";
import { Label } from "ui/label";
import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "ui/select";
import {
  Heart,
  MessageCircle,
  User,
  Palette,
  ArrowLeft,
  Loader,
  Sparkles,
  Quote,
  Play,
  GitBranch,
  ExternalLink,
  Edit,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ChatNodeCanvas } from "@/components/chat-node-canvas";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "ui/tabs";
import { Separator } from "ui/separator";
import { Skeleton } from "ui/skeleton";
import { Textarea } from "ui/textarea";

export default function CharacterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const t = useTranslations("CharacterDetail");

  // Fetch character
  const { data: character, isLoading: characterLoading } = useSWR<Character>(
    `/api/character/${id}`,
    fetcher,
  );

  // Fetch user's personas
  const { data: personas } = useSWR<Persona[]>("/api/persona", fetcher);

  // Fetch user's style presets
  const { data: stylesData } = useSWR<{
    presets: StylePreset[];
    templates: typeof DEFAULT_STYLE_PRESETS;
  }>("/api/style-preset", fetcher);

  // Fetch threads for this character
  const { data: threads, isLoading: threadsLoading } = useSWR<
    (ChatThread & { lastMessageAt: number })[]
  >(character ? `/api/character/${id}/threads` : null, fetcher);

  // Fetch comments
  const { data: comments, isLoading: commentsLoading } = useSWR<
    CharacterComment[]
  >(character ? `/api/character/${id}/comments` : null, fetcher);

  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("");
  const [selectedStyleId, setSelectedStyleId] = useState<string>("");
  const [isStarting, setIsStarting] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "history">("chat");

  // Set defaults when data loads
  const defaultPersona = personas?.find((p) => p.isDefault);
  const defaultStyle = stylesData?.presets?.find((s) => s.isDefault);

  // Get latest thread for resume functionality
  const latestThread = threads?.[0];

  const handleStartChat = async (threadId?: string) => {
    if (!character) return;

    const useExisting = !!threadId;
    const targetThreadId = threadId || generateUUID();

    setIsStarting(true);
    try {
      if (!useExisting) {
        // Create new thread
        const response = await fetch("/api/thread", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: targetThreadId,
            title: `Chat with ${character.name}`,
            characterId: character.id,
            personaId: selectedPersonaId || defaultPersona?.id,
            stylePresetId: selectedStyleId || defaultStyle?.id,
            greeting: character.greeting,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to create chat");
        }
      }

      // Redirect to the chat
      router.push(`/chat/${targetThreadId}`);
    } catch (error) {
      console.error("Failed to start chat:", error);
      toast.error("Failed to start chat");
      setIsStarting(false);
    }
  };

  const handleSelectThread = useCallback((threadId: string) => {
    router.push(`/chat/${threadId}`);
  }, [router]);

  if (characterLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!character) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-muted-foreground">{t("notFoundMessage")}</p>
        <Link href="/characters">
          <Button variant="outline">
            <ArrowLeft className="size-4 mr-2" />
            {t("notFoundCta")}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full w-full">
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Back Button */}
        <Link
          href="/characters"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="size-4" />
          {t("backLink")}
        </Link>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Character Info */}
          <div className="lg:col-span-1 space-y-4">
            {/* Character Card */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <Avatar className="size-24 border-4 border-background shadow-xl mb-4">
                    <AvatarImage src={character.avatar} />
                    <AvatarFallback className="bg-gradient-to-br from-pink-500 to-purple-500 text-white text-3xl">
                      {character.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <h1 className="text-2xl font-bold">{character.name}</h1>
                  {character.tagline && (
                    <p className="text-muted-foreground mt-1">{character.tagline}</p>
                  )}
                  
                  {/* Stats */}
                  <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Heart className="size-4 text-pink-500" />
                      <span>{character.likeCount || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageCircle className="size-4 text-blue-500" />
                      <span>{character.chatCount || 0}</span>
                    </div>
                  </div>

                  {/* Edit button for owner */}
                  <Link href={`/character/${character.id}/edit`} className="mt-4 w-full">
                    <Button variant="outline" size="sm" className="w-full">
                      <Edit className="size-4 mr-2" />
                      Edit Character
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Creator Card */}
            {character.creatorUsername && (
              <Link href={`/creator/${character.creatorUsername}`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center size-10 rounded-full bg-primary/10">
                        <User className="size-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-1">
                          <span className="font-medium">@{character.creatorUsername}</span>
                          <ExternalLink className="size-3 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-muted-foreground">View all bots</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )}

            {/* Tags */}
            {character.tags && character.tags.length > 0 && (
              <Card>
                <CardContent className="pt-4">
                  <div className="flex flex-wrap gap-2">
                    {character.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Description */}
            {character.description && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">About</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {character.description}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Chat & History */}
          <div className="lg:col-span-2 space-y-4">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "chat" | "history")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="chat">
                  <MessageCircle className="size-4 mr-2" />
                  Chat
                </TabsTrigger>
                <TabsTrigger value="history">
                  <GitBranch className="size-4 mr-2" />
                  History ({threads?.length || 0})
                </TabsTrigger>
              </TabsList>

              {/* Chat Tab */}
              <TabsContent value="chat" className="mt-4 space-y-4">
                {/* Quick Actions */}
                <div className="flex gap-2">
                  {latestThread && (
                    <Button
                      size="lg"
                      className="flex-1"
                      onClick={() => handleStartChat(latestThread.id)}
                      disabled={isStarting}
                    >
                      {isStarting ? (
                        <Loader className="size-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="size-4 mr-2" />
                      )}
                      Resume Chat
                    </Button>
                  )}
                  <Button
                    size="lg"
                    variant={latestThread ? "outline" : "default"}
                    className={latestThread ? "" : "flex-1"}
                    onClick={() => handleStartChat()}
                    disabled={isStarting}
                  >
                    <Sparkles className="size-4 mr-2" />
                    New Chat
                  </Button>
                </div>

                {/* Chat Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Chat Settings</CardTitle>
                    <CardDescription>
                      Customize your conversation with {character.name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Persona Selector */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <User className="size-4" />
                        {t("personaLabel")}
                      </Label>
                      <Select
                        value={selectedPersonaId || defaultPersona?.id || "none"}
                        onValueChange={setSelectedPersonaId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("personaPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t("personaNoneOption")}</SelectItem>
                          {personas?.map((persona) => (
                            <SelectItem key={persona.id} value={persona.id}>
                              <div className="flex items-center gap-2">
                                {persona.name}
                                {persona.isDefault && (
                                  <Badge variant="secondary" className="text-xs">
                                    {t("defaultBadge")}
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {personas?.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          {t.rich("personaEmptyHint", {
                            link: (chunks) => (
                              <Link
                                href="/persona"
                                className="text-primary hover:underline"
                              >
                                {chunks}
                              </Link>
                            ),
                          })}
                        </p>
                      )}
                    </div>

                    {/* Style Selector */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Palette className="size-4" />
                        {t("styleLabel")}
                      </Label>
                      <Select
                        value={selectedStyleId || defaultStyle?.id || "none"}
                        onValueChange={setSelectedStyleId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("stylePlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            {t("styleDefaultOption")}
                          </SelectItem>
                          {stylesData?.presets?.map((style) => (
                            <SelectItem key={style.id} value={style.id}>
                              <div className="flex items-center gap-2">
                                {style.name}
                                {style.isDefault && (
                                  <Badge variant="secondary" className="text-xs">
                                    {t("defaultBadge")}
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* Greeting Preview */}
                {character.greeting && (
                  <Card className="border-primary/20 bg-primary/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Quote className="size-4 text-primary" />
                        First Message
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-3">
                        <Avatar className="size-10">
                          <AvatarImage src={character.avatar} />
                          <AvatarFallback className="bg-primary/20 text-primary">
                            {character.name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 bg-background rounded-lg p-3 border">
                          <p className="font-medium text-sm mb-1">{character.name}</p>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {character.greeting}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* History Tab - Node Canvas */}
              <TabsContent value="history" className="mt-4">
                <div className="h-[500px]">
                  <ChatNodeCanvas
                    character={character}
                    threads={threads || []}
                    currentThreadId={null}
                    onSelectThread={handleSelectThread}
                    onStartNewChat={() => handleStartChat()}
                    isLoading={threadsLoading}
                  />
                </div>
              </TabsContent>
            </Tabs>

            {/* Comments Section */}
            <Separator className="my-6" />
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <MessageCircle className="size-5" />
                Comments
              </h3>

              {/* Comment input - stub for now */}
              <Card>
                <CardContent className="pt-4">
                  <Textarea
                    placeholder="Write a comment... (coming soon)"
                    disabled
                    className="resize-none"
                    rows={2}
                  />
                  <div className="flex justify-end mt-2">
                    <Button size="sm" disabled>
                      Post Comment
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Comments list */}
              {commentsLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <Card key={i}>
                      <CardContent className="pt-4">
                        <div className="flex gap-3">
                          <Skeleton className="size-10 rounded-full" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-4 w-full" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : comments && comments.length > 0 ? (
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <Card key={comment.id}>
                      <CardContent className="pt-4">
                        <div className="flex gap-3">
                          <Avatar className="size-10">
                            <AvatarImage src={comment.userAvatar} />
                            <AvatarFallback>
                              {comment.userName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {comment.userName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(comment.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm mt-1">{comment.content}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageCircle className="size-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No comments yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}