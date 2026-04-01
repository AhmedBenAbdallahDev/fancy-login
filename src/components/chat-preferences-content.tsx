"use client";
import { useObjectState } from "@/hooks/use-object-state";
import { UserPreferences } from "app-types/user";
import { authClient } from "auth/client";
import { fetcher } from "lib/utils";
import { AlertCircle, ArrowLeft, Loader } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { safe } from "ts-safe";

import { Button } from "ui/button";
import { ExamplePlaceholder } from "ui/example-placeholder";
import { Input } from "ui/input";
import { Label } from "ui/label";
import { Skeleton } from "ui/skeleton";
import { Textarea } from "ui/textarea";
import { McpServerCustomizationContent } from "./mcp-customization-popup";
import { MCPServerInfo } from "app-types/mcp";
import { useMcpList } from "@/hooks/queries/use-mcp-list";
import { useChatModels } from "@/hooks/queries/use-chat-models";
import { Switch } from "ui/switch";

export function UserInstructionsContent() {
  const t = useTranslations();

  const responseStyleExamples = useMemo(
    () => [
      t("Chat.ChatPreferences.responseStyleExample1"),
      t("Chat.ChatPreferences.responseStyleExample2"),
      t("Chat.ChatPreferences.responseStyleExample3"),
      t("Chat.ChatPreferences.responseStyleExample4"),
    ],
    [],
  );

  const professionExamples = useMemo(
    () => [
      t("Chat.ChatPreferences.professionExample1"),
      t("Chat.ChatPreferences.professionExample2"),
      t("Chat.ChatPreferences.professionExample3"),
      t("Chat.ChatPreferences.professionExample4"),
      t("Chat.ChatPreferences.professionExample5"),
    ],
    [],
  );

  const { data: session } = authClient.useSession();

  const [preferences, setPreferences] = useObjectState<UserPreferences>({
    displayName: "",
    responseStyleExample: "",
    profession: "",
    botName: "",
    roleplay: {
      narrationOpacity: 0.65,
    },
  });

  const narrationOpacityPercent = useMemo(() => {
    const value = preferences.roleplay?.narrationOpacity ?? 0.65;
    return Math.round(Math.min(1, Math.max(0.2, value)) * 100);
  }, [preferences.roleplay?.narrationOpacity]);

  const {
    data,
    mutate: fetchPreferences,
    isLoading,
    isValidating,
  } = useSWR<UserPreferences>("/api/user/preferences", fetcher, {
    fallback: {},
    dedupingInterval: 0,
    onSuccess: (data) => {
      setPreferences(data);
    },
  });

  const [isSaving, setIsSaving] = useState(false);

  const savePreferences = async () => {
    safe(() => setIsSaving(true))
      .ifOk(() =>
        fetch("/api/user/preferences", {
          method: "PUT",
          body: JSON.stringify(preferences),
        }),
      )
      .ifOk(() => fetchPreferences())
      .watch((result) => {
        if (result.isOk)
          toast.success(t("Chat.ChatPreferences.preferencesSaved"));
        else toast.error(t("Chat.ChatPreferences.failedToSavePreferences"));
      })
      .watch(() => setIsSaving(false));
  };

  const isDiff = useMemo(() => {
    if ((data?.displayName || "") !== (preferences.displayName || ""))
      return true;
    if ((data?.profession || "") !== (preferences.profession || ""))
      return true;
    if (
      (data?.responseStyleExample || "") !==
      (preferences.responseStyleExample || "")
    )
      return true;
    if ((data?.botName || "") !== (preferences.botName || "")) return true;
    if (
      (data?.roleplay?.narrationOpacity ?? 0.65) !==
      (preferences.roleplay?.narrationOpacity ?? 0.65)
    )
      return true;
    return false;
  }, [preferences, data]);

  return (
    <div className="flex flex-col">
      <h3 className="text-xl font-semibold">
        {t("Chat.ChatPreferences.userInstructions")}
      </h3>
      <p className="text-sm text-muted-foreground py-2 pb-6">
        {t("Chat.ChatPreferences.userInstructionsDescription")}
      </p>

      <div className="flex flex-col gap-6 w-full">
        <div className="flex flex-col gap-2">
          <Label>{t("Chat.ChatPreferences.whatShouldWeCallYou")}</Label>
          {isLoading ? (
            <Skeleton className="h-9" />
          ) : (
            <Input
              placeholder={session?.user.name || ""}
              value={preferences.displayName}
              onChange={(e) => {
                setPreferences({
                  displayName: e.target.value,
                });
              }}
            />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label>{t("Chat.ChatPreferences.botName")}</Label>
          {isLoading ? (
            <Skeleton className="h-9" />
          ) : (
            <Input
              placeholder="Luminar AI"
              value={preferences.botName}
              onChange={(e) => {
                setPreferences({
                  botName: e.target.value,
                });
              }}
            />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label>RP narration opacity (*asterisk* text)</Label>
          {isLoading ? (
            <Skeleton className="h-9" />
          ) : (
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={20}
                max={100}
                step={1}
                value={narrationOpacityPercent}
                onChange={(e) => {
                  const value = Number(e.target.value) / 100;
                  setPreferences({
                    roleplay: {
                      ...preferences.roleplay,
                      narrationOpacity: value,
                    },
                  });
                }}
                className="w-full accent-primary"
              />
              <span className="text-xs text-muted-foreground min-w-12 text-right">
                {narrationOpacityPercent}%
              </span>
            </div>
          )}
          <div className="mt-2 p-3 rounded-md bg-muted/50 border border-border">
            <p className="text-xs font-medium mb-1 text-muted-foreground uppercase tracking-widest">Preview</p>
            <div className="text-sm">
              <span style={{ opacity: preferences.roleplay?.narrationOpacity ?? 0.65 }}>*The bot sighs softly, looking at you.*</span>
              <span className="ml-1">"I think this opacity looks just right, don't you?"</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            In roleplay chats, text inside *asterisks* uses this opacity.
          </p>
        </div>

        <div className="flex flex-col gap-2 text-foreground flex-1">
          <Label>{t("Chat.ChatPreferences.whatBestDescribesYourWork")}</Label>
          <div className="relative w-full">
            {isLoading ? (
              <Skeleton className="h-9" />
            ) : (
              <>
                <Input
                  value={preferences.profession}
                  onChange={(e) => {
                    setPreferences({
                      profession: e.target.value,
                    });
                  }}
                />
                {(preferences.profession?.length ?? 0) === 0 && (
                  <div className="absolute left-0 top-0 w-full h-full py-2 px-4 pointer-events-none">
                    <ExamplePlaceholder placeholder={professionExamples} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 text-foreground">
          <Label>
            {t(
              "Chat.ChatPreferences.whatPersonalPreferencesShouldBeTakenIntoAccountInResponses",
            )}
          </Label>
          <span className="text-xs text-muted-foreground"></span>
          <div className="relative w-full">
            {isLoading ? (
              <Skeleton className="h-60" />
            ) : (
              <>
                <Textarea
                  className="h-60 resize-none"
                  value={preferences.responseStyleExample}
                  onChange={(e) => {
                    setPreferences({
                      responseStyleExample: e.target.value,
                    });
                  }}
                />
                {(preferences.responseStyleExample?.length ?? 0) === 0 && (
                  <div className="absolute left-0 top-0 w-full h-full py-2 px-4 pointer-events-none">
                    <ExamplePlaceholder placeholder={responseStyleExamples} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {isDiff && !isValidating && (
        <div className="flex pt-4 items-center justify-end fade-in animate-in duration-300">
          <Button variant="ghost">{t("Common.cancel")}</Button>
          <Button disabled={isSaving || isLoading} onClick={savePreferences}>
            {t("Common.save")}
            {isSaving && <Loader className="size-4 ml-2 animate-spin" />}
          </Button>
        </div>
      )}
    </div>
  );
}

export function MCPInstructionsContent() {
  const t = useTranslations("");
  const [search, setSearch] = useState("");
  const [mcpServer, setMcpServer] = useState<
    (MCPServerInfo & { id: string }) | null
  >(null);

  const { isLoading, data: mcpList } = useMcpList({
    dedupingInterval: 0,
  });

  if (mcpServer) {
    return (
      <McpServerCustomizationContent
        title={
          <div className="flex flex-col">
            <button
              onClick={() => setMcpServer(null)}
              className="flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground transition-colors mb-8"
            >
              <ArrowLeft className="size-3" />
              {t("Common.back")}
            </button>
            {mcpServer.name}
          </div>
        }
        mcpServerInfo={mcpServer}
      />
    );
  }

  return (
    <div className="flex flex-col">
      <h3 className="text-xl font-semibold">
        {t("Chat.ChatPreferences.mcpInstructions")}
      </h3>
      <p className="text-sm text-muted-foreground py-2 pb-6">
        {t("Chat.ChatPreferences.mcpInstructionsDescription")}
      </p>

      <div className="flex flex-col gap-6 w-full">
        <div className="flex flex-col gap-2 text-foreground flex-1">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            placeholder={t("Common.search")}
          />
        </div>
        <div className="flex flex-col gap-2 text-foreground flex-1">
          {isLoading ? (
            Array.from({ length: 10 }).map((_, index) => (
              <Skeleton key={index} className="h-14" />
            ))
          ) : mcpList.length === 0 ? (
            <div className="flex flex-col gap-2 text-foreground flex-1">
              <p className="text-center py-8 text-muted-foreground">
                {t("MCP.configureYourMcpServerConnectionSettings")}
              </p>
            </div>
          ) : (
            <div className="flex gap-2">
              {mcpList.map((mcp) => (
                <Button
                  onClick={() => setMcpServer({ ...mcp, id: mcp.id })}
                  variant={"outline"}
                  size={"lg"}
                  key={mcp.id}
                >
                  <p>{mcp.name}</p>
                  {mcp.error ? (
                    <AlertCircle className="size-3.5 text-destructive" />
                  ) : mcp.status == "loading" ? (
                    <Loader className="size-3.5 animate-spin" />
                  ) : null}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AiProviderConfigContent() {
  const t = useTranslations();

  const { data: modelProviders } = useChatModels();

  const [preferences, setPreferences] = useObjectState<UserPreferences>({
    apiKeys: {},
    roleplay: {
      narrationOpacity: 0.65,
    },
    generation: {
      maxContextTokensDefault: 60000,
      maxContextTokensByModel: {},
      advanced: {
        enabled: false,
      },
    },
  });

  const narrationOpacityPercent = useMemo(() => {
    const value = preferences.roleplay?.narrationOpacity ?? 0.65;
    return Math.round(Math.min(1, Math.max(0.2, value)) * 100);
  }, [preferences.roleplay?.narrationOpacity]);

  const {
    data,
    mutate: fetchPreferences,
    isLoading,
    isValidating,
  } = useSWR<UserPreferences>("/api/user/preferences", fetcher, {
    fallback: {},
    dedupingInterval: 0,
    onSuccess: (data) => {
      setPreferences(data);
    },
  });

  const [isSaving, setIsSaving] = useState(false);

  const savePreferences = async () => {
    safe(() => setIsSaving(true))
      .ifOk(() =>
        fetch("/api/user/preferences", {
          method: "PUT",
          body: JSON.stringify(preferences),
        }),
      )
      .ifOk(() => fetchPreferences())
      .watch((result) => {
        if (result.isOk)
          toast.success(t("Chat.ChatPreferences.preferencesSaved"));
        else toast.error(t("Chat.ChatPreferences.failedToSavePreferences"));
      })
      .watch(() => setIsSaving(false));
  };

  const isDiff = useMemo(() => {
    return JSON.stringify(data || {}) !== JSON.stringify(preferences || {});
  }, [preferences, data]);

  const providers = ["anvil", "openai", "anthropic", "google", "xai", "nvidia"];

  const defaultMaxContext =
    preferences.generation?.maxContextTokensDefault ?? 60000;
  const advancedEnabled = Boolean(preferences.generation?.advanced?.enabled);

  return (
    <div className="flex flex-col">
      <h3 className="text-xl font-semibold">AI Provider Config</h3>
      <p className="text-sm text-muted-foreground py-2 pb-6">
        Configure your own API keys for AI providers. If left empty, the system
        default keys will be used.
      </p>

      <div className="flex flex-col gap-3 pb-6">
        <Label>Default max context (tokens)</Label>
        <Input
          type="number"
          min={1024}
          max={200000}
          value={defaultMaxContext}
          onChange={(e) => {
            const value = Number(e.target.value || 60000);
            setPreferences({
              generation: {
                ...preferences.generation,
                maxContextTokensDefault: value,
              },
            });
          }}
        />

        <div className="flex flex-col gap-2">
          <Label>RP narration opacity (*asterisk* text)</Label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={20}
              max={100}
              step={1}
              value={narrationOpacityPercent}
              onChange={(e) => {
                const value = Number(e.target.value) / 100;
                setPreferences({
                  roleplay: {
                    ...preferences.roleplay,
                    narrationOpacity: value,
                  },
                });
              }}
              className="w-full accent-primary"
            />
            <span className="text-xs text-muted-foreground min-w-12 text-right">
              {narrationOpacityPercent}%
            </span>
          </div>
          <div className="mt-2 p-3 rounded-md bg-muted/50 border border-border">
            <p className="text-xs font-medium mb-1 text-muted-foreground uppercase tracking-widest">Preview</p>
            <div className="text-sm">
              <span style={{ opacity: preferences.roleplay?.narrationOpacity ?? 0.65 }}>*The bot sighs softly, looking at you.*</span>
              <span className="ml-1">"I think this opacity looks just right, don't you?"</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            In roleplay chats, text inside *asterisks* uses this opacity.
          </p>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Label>Advanced generation settings</Label>
            <div className="text-xs px-2 py-1 rounded-md bg-amber-500/10 text-amber-600 w-fit">
              For advanced users only
            </div>
          </div>

          <Switch
            checked={advancedEnabled}
            onCheckedChange={(checked) => {
              setPreferences({
                generation: {
                  ...preferences.generation,
                  advanced: {
                    ...preferences.generation?.advanced,
                    enabled: checked,
                  },
                },
              });
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label>Temperature</Label>
            <Input
              type="number"
              step={0.1}
              min={0}
              max={2}
              disabled={!advancedEnabled}
              value={preferences.generation?.advanced?.temperature ?? ""}
              onChange={(e) => {
                const value =
                  e.target.value === "" ? undefined : Number(e.target.value);
                setPreferences({
                  generation: {
                    ...preferences.generation,
                    advanced: {
                      ...preferences.generation?.advanced,
                      temperature: value,
                    },
                  },
                });
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Top P</Label>
            <Input
              type="number"
              step={0.05}
              min={0}
              max={1}
              disabled={!advancedEnabled}
              value={preferences.generation?.advanced?.topP ?? ""}
              onChange={(e) => {
                const value =
                  e.target.value === "" ? undefined : Number(e.target.value);
                setPreferences({
                  generation: {
                    ...preferences.generation,
                    advanced: {
                      ...preferences.generation?.advanced,
                      topP: value,
                    },
                  },
                });
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Top K</Label>
            <Input
              type="number"
              min={1}
              max={10000}
              disabled={!advancedEnabled}
              value={preferences.generation?.advanced?.topK ?? ""}
              onChange={(e) => {
                const value =
                  e.target.value === "" ? undefined : Number(e.target.value);
                setPreferences({
                  generation: {
                    ...preferences.generation,
                    advanced: {
                      ...preferences.generation?.advanced,
                      topK: value,
                    },
                  },
                });
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Max output tokens</Label>
            <Input
              type="number"
              min={1}
              max={32768}
              disabled={!advancedEnabled}
              value={preferences.generation?.advanced?.maxOutputTokens ?? ""}
              onChange={(e) => {
                const value =
                  e.target.value === "" ? undefined : Number(e.target.value);
                setPreferences({
                  generation: {
                    ...preferences.generation,
                    advanced: {
                      ...preferences.generation?.advanced,
                      maxOutputTokens: value,
                    },
                  },
                });
              }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 w-full">
        {providers.map((provider) => (
          <div key={provider} className="flex flex-col gap-2">
            <Label className="capitalize">{provider}</Label>
            {isLoading ? (
              <Skeleton className="h-9" />
            ) : (
              <Input
                type="password"
                placeholder={`Enter your ${provider} API key`}
                value={preferences.apiKeys?.[provider] || ""}
                onChange={(e) => {
                  setPreferences({
                    apiKeys: {
                      ...preferences.apiKeys,
                      [provider]: e.target.value,
                    },
                  });
                }}
              />
            )}

            {/* Per-model context settings */}
            {modelProviders
              ?.filter((p) => p.provider === provider)
              .flatMap((p) => p.models)
              .map((m) => {
                const key = `${provider}:${m.name}`;
                const value =
                  preferences.generation?.maxContextTokensByModel?.[key] ??
                  defaultMaxContext;

                return (
                  <div key={key} className="flex items-center gap-3 pt-1">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">
                        {m.displayName || m.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {m.name}
                      </p>
                    </div>
                    <Input
                      className="w-36"
                      type="number"
                      min={1024}
                      max={200000}
                      value={value}
                      onChange={(e) => {
                        const num = Number(e.target.value || defaultMaxContext);
                        setPreferences({
                          generation: {
                            ...preferences.generation,
                            maxContextTokensByModel: {
                              ...(preferences.generation
                                ?.maxContextTokensByModel || {}),
                              [key]: num,
                            },
                          },
                        });
                      }}
                    />
                  </div>
                );
              })}
          </div>
        ))}
      </div>
      {isDiff && !isValidating && (
        <div className="flex pt-4 items-center justify-end fade-in animate-in duration-300">
          <Button variant="ghost">{t("Common.cancel")}</Button>
          <Button disabled={isSaving || isLoading} onClick={savePreferences}>
            {t("Common.save")}
            {isSaving && <Loader className="size-4 ml-2 animate-spin" />}
          </Button>
        </div>
      )}
    </div>
  );
}
