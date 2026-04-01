"use client";

import { appStore } from "@/app/store";
import { useShallow } from "zustand/shallow";
import useSWR from "swr";
import { fetcher } from "lib/utils";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "ui/drawer";
import { Button } from "ui/button";
import { Separator } from "ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "ui/tabs";
import { ScrollArea } from "ui/scroll-area";
import { Copy, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import type { UIMessage } from "ai";
import { useEffect, useMemo } from "react";

function findSummaryMessage(messages: UIMessage[]): UIMessage | null {
  // Summary badge is stored in annotations
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const annotations =
      (msg.annotations as any[] | null | undefined) ?? undefined;
    const isSummary = annotations?.some((a) => a?.isSummaryBadge) ?? false;
    if (isSummary) return msg;
  }
  return null;
}

function findAllSummaryMessages(messages: UIMessage[]): UIMessage[] {
  return messages.filter((msg) => {
    const annotations =
      (msg.annotations as any[] | null | undefined) ?? undefined;
    return annotations?.some((a) => a?.isSummaryBadge) ?? false;
  });
}

function getSummaryMeta(msg: UIMessage | null): {
  summarizedCount: number;
  summarizedTokens: number;
  rawAnnotation: any | null;
} {
  if (!msg)
    return { summarizedCount: 0, summarizedTokens: 0, rawAnnotation: null };
  const annotations =
    (msg.annotations as any[] | null | undefined) ?? undefined;
  const a = annotations?.find((x) => x?.isSummaryBadge) ?? null;
  return {
    summarizedCount: a?.summarizedCount ?? 0,
    summarizedTokens: a?.summarizedTokens ?? 0,
    rawAnnotation: a,
  };
}

function pickDebug(rawAnnotation: any | null | undefined) {
  const dbg = rawAnnotation?.debug ?? rawAnnotation;
  if (!dbg) return null;
  // tolerate older shape (fields at top-level) and newer nested shape
  return {
    mode: dbg?.summaryMode ?? dbg?.mode,
    triggerThreshold: dbg?.triggerThreshold,
    currentTokensAtTrigger: dbg?.currentTokensAtTrigger,
    maxContextTokens: dbg?.maxContextTokens,
    maxOutputTokens: dbg?.maxOutputTokens,
    maxInputTokens: dbg?.maxInputTokens,
    keptRecentMessages: dbg?.keptRecentMessages,
    summaryTargetTokens: dbg?.summaryTargetTokens,
    summaryTemperature: dbg?.summaryTemperature,
    model: dbg?.model,
  };
}

function extractText(msg: UIMessage | null): string {
  if (!msg) return "";
  return (
    msg.parts
      ?.map((p: any) => (p?.type === "text" ? p.text : ""))
      .filter(Boolean)
      .join("\n") ?? ""
  );
}

export function ChatMemoryExplorer() {
  const [memoryExplorer, currentThreadId, mutateApp] = appStore(
    useShallow((state) => [
      state.memoryExplorer,
      state.currentThreadId,
      state.mutate,
    ]),
  );

  const threadId = currentThreadId ?? undefined;

  const swrKey = threadId ? `/api/chat/${threadId}` : null;
  const {
    data: messages,
    isLoading,
    mutate,
    error,
  } = useSWR<UIMessage[]>(swrKey, fetcher, {
    dedupingInterval: 0,
    refreshInterval: memoryExplorer.isOpen ? 2000 : 0,
    revalidateOnFocus: true,
  });

  useEffect(() => {
    if (!memoryExplorer.isOpen) return;
    if (!swrKey) return;
    // When opening the drawer, immediately sync from server.
    mutate();
  }, [memoryExplorer.isOpen, swrKey, mutate]);

  const summaryMessage = useMemo(
    () => (messages ? findSummaryMessage(messages) : null),
    [messages],
  );
  const allSummaryMessages = useMemo(
    () => (messages ? findAllSummaryMessages(messages) : []),
    [messages],
  );
  const summaryText = useMemo(
    () => extractText(summaryMessage),
    [summaryMessage],
  );
  const summaryMeta = useMemo(
    () => getSummaryMeta(summaryMessage),
    [summaryMessage],
  );
  const debugInfo = useMemo(
    () => pickDebug(summaryMeta.rawAnnotation),
    [summaryMeta.rawAnnotation],
  );

  const setOpen = (open: boolean) => {
    mutateApp((state) => ({
      memoryExplorer: {
        ...state.memoryExplorer,
        isOpen: open,
      },
    }));
  };

  const onCopy = async () => {
    if (!summaryText) {
      toast.error("No summary to copy");
      return;
    }
    await navigator.clipboard.writeText(summaryText);
    toast.success("Summary copied");
  };

  const onRefresh = async () => {
    if (!threadId) return;
    await mutate();
    toast.success("Refreshed");
  };

  return (
    <Drawer
      handleOnly
      direction="right"
      open={memoryExplorer.isOpen}
      onOpenChange={setOpen}
    >
      <DrawerContent className="w-full md:w-2xl px-2 flex flex-col">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <span className="font-semibold">Memory</span>
            <div className="flex-1" />

            <Button
              variant={"secondary"}
              className="rounded-full"
              onClick={onRefresh}
              disabled={!threadId}
            >
              <RefreshCw className="size-4" />
            </Button>

            <Button
              variant={"secondary"}
              className="rounded-full"
              onClick={onCopy}
              disabled={!summaryText}
            >
              <Copy className="size-4" />
            </Button>

            <DrawerClose asChild>
              <Button
                variant={"secondary"}
                className="flex items-center gap-1 rounded-full"
              >
                <X className="size-4" />
                <Separator orientation="vertical" />
                <span className="text-xs text-muted-foreground ml-1">ESC</span>
              </Button>
            </DrawerClose>
          </DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-4">
          {!threadId ? (
            <div className="text-sm text-muted-foreground">
              Open a chat thread to view memory.
            </div>
          ) : (
            <Tabs defaultValue="summary">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="status">Status</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="mt-3">
                <ScrollArea className="h-[60vh] rounded-md border p-3">
                  {isLoading ? (
                    <div className="text-sm text-muted-foreground">
                      Loading…
                    </div>
                  ) : error ? (
                    <div className="text-sm text-red-600">
                      Failed to load summary.
                    </div>
                  ) : summaryText ? (
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed">
                      {summaryText}
                    </pre>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      No summary message found yet. It will appear after
                      auto-summary triggers.
                    </div>
                  )}
                </ScrollArea>

                <div className="mt-3 text-xs text-muted-foreground">
                  Tip: use this panel to verify the summary is persisted in
                  history.
                </div>
              </TabsContent>

              <TabsContent value="status" className="mt-3">
                <div className="rounded-md border p-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Thread</span>
                    <span className="font-mono text-xs">{threadId}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Messages</span>
                    <span>{messages?.length ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Summary present
                    </span>
                    <span>{summaryMessage ? "Yes" : "No"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Summary msgs found
                    </span>
                    <span>{allSummaryMessages.length}</span>
                  </div>
                </div>

                {summaryMessage && (
                  <div className="mt-3 rounded-md border p-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        Summary message id
                      </span>
                      <span className="font-mono text-xs">
                        {summaryMessage.id}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Role</span>
                      <span>{summaryMessage.role}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Created</span>
                      <span className="font-mono text-xs">
                        {summaryMessage.createdAt
                          ? new Date(
                              summaryMessage.createdAt as any,
                            ).toISOString()
                          : "(missing)"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        Summarized msgs
                      </span>
                      <span>{summaryMeta.summarizedCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        Summarized tokens
                      </span>
                      <span>{summaryMeta.summarizedTokens}</span>
                    </div>
                    {debugInfo && (
                      <>
                        <div className="pt-2" />
                        <div className="text-xs text-muted-foreground font-medium">
                          Backend context debug
                        </div>
                        {debugInfo.model && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Model</span>
                            <span className="font-mono text-xs">
                              {debugInfo.model}
                            </span>
                          </div>
                        )}
                        {debugInfo.mode && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Mode</span>
                            <span>{debugInfo.mode}</span>
                          </div>
                        )}
                        {typeof debugInfo.maxContextTokens === "number" && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              Context cap
                            </span>
                            <span>{debugInfo.maxContextTokens}</span>
                          </div>
                        )}
                        {typeof debugInfo.maxOutputTokens === "number" && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              Max output
                            </span>
                            <span>{debugInfo.maxOutputTokens}</span>
                          </div>
                        )}
                        {typeof debugInfo.maxInputTokens === "number" && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              Input budget
                            </span>
                            <span>{debugInfo.maxInputTokens}</span>
                          </div>
                        )}
                        {typeof debugInfo.triggerThreshold === "number" && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              Trigger threshold
                            </span>
                            <span>
                              {Math.round(debugInfo.triggerThreshold)}
                            </span>
                          </div>
                        )}
                        {typeof debugInfo.currentTokensAtTrigger ===
                          "number" && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              Tokens at trigger
                            </span>
                            <span>
                              {Math.round(debugInfo.currentTokensAtTrigger)}
                            </span>
                          </div>
                        )}
                        {typeof debugInfo.keptRecentMessages === "number" && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              Kept recent
                            </span>
                            <span>{debugInfo.keptRecentMessages}</span>
                          </div>
                        )}
                        {typeof debugInfo.summaryTemperature === "number" && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              Summary temp
                            </span>
                            <span>{debugInfo.summaryTemperature}</span>
                          </div>
                        )}
                        {typeof debugInfo.summaryTargetTokens === "number" && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              Summary max tokens
                            </span>
                            <span>{debugInfo.summaryTargetTokens}</span>
                          </div>
                        )}
                      </>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        Summary text length
                      </span>
                      <span>{summaryText.length}</span>
                    </div>
                    <details className="pt-2">
                      <summary className="cursor-pointer text-xs text-muted-foreground">
                        Raw summary annotation
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap text-xs rounded-md bg-muted p-2">
                        {JSON.stringify(summaryMeta.rawAnnotation, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}

                <div className="mt-3 text-xs text-muted-foreground">
                  If the summary appears briefly then vanishes, it’s usually a
                  UI reconciliation issue (fixed by stable keys) or a refetch
                  timing issue.
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
