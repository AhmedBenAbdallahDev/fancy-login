"use client";

import { SidebarGroupLabel, SidebarMenuSub } from "ui/sidebar";
import Link from "next/link";
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuSkeleton,
  SidebarMenuSubItem,
} from "ui/sidebar";
import { SidebarGroupContent, SidebarMenu, SidebarMenuItem } from "ui/sidebar";
import { SidebarGroup } from "ui/sidebar";
import { ThreadDropdown } from "../thread-dropdown";
import {
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Trash,
  Sparkles,
} from "lucide-react";
import { useMounted } from "@/hooks/use-mounted";
import { appStore } from "@/app/store";
import { Button } from "ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "ui/dropdown-menu";
import {
  deleteThreadsAction,
  deleteUnarchivedThreadsAction,
} from "@/app/api/chat/actions";
import { fetcher } from "lib/utils";
import { toast } from "sonner";
import { useShallow } from "zustand/shallow";
import { usePathname, useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import { handleErrorWithToast } from "ui/shared-toast";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { useTranslations } from "next-intl";
import { TextShimmer } from "ui/text-shimmer";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";

type ThreadGroup = {
  label: string;
  threads: any[];
};

const MAX_THREADS_COUNT = 40;

export function AppSidebarThreads() {
  const mounted = useMounted();
  const router = useRouter();
  const t = useTranslations("Layout");
  const [
    storeMutate,
    currentThreadId,
    generatingTitleThreadIds,
    storeThreadList,
  ] = appStore(
    useShallow((state) => [
      state.mutate,
      state.currentThreadId,
      state.generatingTitleThreadIds,
      state.threadList,
    ]),
  );
  // State to track if expanded view is active
  const [isExpanded, setIsExpanded] = useState(false);
  const [loadingThreadId, setLoadingThreadId] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    setLoadingThreadId(null);
  }, [pathname]);

  const { isLoading } = useSWR("/api/thread", fetcher, {
    onError: handleErrorWithToast,
    fallbackData: [],
    onSuccess: (data: any[]) => {
      storeMutate((prev) => {
        // SERVER DATA IS SOURCE OF TRUTH - use it directly
        // Only merge in optimistic title updates for threads that still exist on server
        const serverThreadMap = new Map(data.map((t: any) => [t.id, t]));
        const existingById = new Map(prev.threadList.map((t) => [t.id, t]));

        // Apply optimistic title updates to server threads
        serverThreadMap.forEach((thread: any, id) => {
          const existing = existingById.get(id);
          // Preserve optimistic title if server doesn't have it yet
          if (existing?.title && !thread.title) {
            serverThreadMap.set(id, { ...thread, title: existing.title });
          }
        });

        // Convert map to array (only threads that exist on server)
        const uniqueThreads = Array.from(serverThreadMap.values());

        // Sort by lastMessageAt or createdAt
        const ownerId =
          uniqueThreads.length > 0 ? (uniqueThreads[0].userId ?? null) : null;

        return {
          threadList: uniqueThreads.sort((a: any, b: any) => {
            const timeA =
              (a as any).lastMessageAt || new Date(a.createdAt).getTime();
            const timeB =
              (b as any).lastMessageAt || new Date(b.createdAt).getTime();
            return timeB - timeA;
          }),
          threadListOwnerId: ownerId,
        };
      });
    },
  });

  // Check if we have 40 or more threads to display "View All" button
  const hasExcessThreads =
    storeThreadList && storeThreadList.length >= MAX_THREADS_COUNT;

  // Use either limited or full thread list based on expanded state
  const displayThreadList = useMemo(() => {
    if (!storeThreadList) return [];
    return !isExpanded && hasExcessThreads
      ? storeThreadList.slice(0, MAX_THREADS_COUNT)
      : storeThreadList;
  }, [storeThreadList, hasExcessThreads, isExpanded]);

  const threadGroupByDate = useMemo(() => {
    if (!displayThreadList || displayThreadList.length === 0) {
      return [];
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const groups: ThreadGroup[] = [
      { label: t("today"), threads: [] },
      { label: t("yesterday"), threads: [] },
      { label: t("lastWeek"), threads: [] },
      { label: t("older"), threads: [] },
    ];

    displayThreadList.forEach((thread) => {
      const t = thread as any;
      const threadDate =
        (t.lastMessageAt
          ? new Date(t.lastMessageAt)
          : new Date(thread.createdAt)) || new Date();
      threadDate.setHours(0, 0, 0, 0);

      if (threadDate.getTime() === today.getTime()) {
        groups[0].threads.push(thread);
      } else if (threadDate.getTime() === yesterday.getTime()) {
        groups[1].threads.push(thread);
      } else if (threadDate.getTime() >= lastWeek.getTime()) {
        groups[2].threads.push(thread);
      } else {
        groups[3].threads.push(thread);
      }
    });

    // Filter out empty groups
    return groups.filter((group) => group.threads.length > 0);
  }, [displayThreadList]);

  const handleDeleteAllThreads = async () => {
    // Store backup for rollback
    const previousThreads = appStore.getState().threadList;

    // Optimistic update
    appStore.setState({ threadList: [] });
    // Also optimize SWR cache
    mutate("/api/thread", [], false);

    await toast.promise(deleteThreadsAction(), {
      loading: t("deletingAllChats"),
      success: () => {
        mutate("/api/thread");
        router.push("/");
        return t("allChatsDeleted");
      },
      error: () => {
        // Rollback on error
        appStore.setState({ threadList: previousThreads });
        mutate("/api/thread"); // Revalidation
        return t("failedToDeleteAllChats");
      },
    });
  };

  const handleDeleteUnarchivedThreads = async () => {
    // Optimistic update implementation for "unarchived only" is complex without
    // knowing archival status client-side, so we rely on fast server response.

    await toast.promise(deleteUnarchivedThreadsAction(), {
      loading: t("deletingUnarchivedChats"),
      success: () => {
        mutate("/api/thread");
        return t("unarchivedChatsDeleted");
      },
      error: () => {
        mutate("/api/thread");
        return t("failedToDeleteUnarchivedChats");
      }, // Rollback not easily possible without knowing which were unarchived client-side
    });
  };

  if (isLoading || storeThreadList?.length === 0)
    return (
      <SidebarGroup>
        <SidebarGroupContent className="group-data-[collapsible=icon]:hidden group/threads">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarGroupLabel className="">
                <h4 className="text-xs text-muted-foreground">
                  {t("recentChats")}
                </h4>
              </SidebarGroupLabel>

              {isLoading ? (
                Array.from({ length: 12 }).map(
                  (_, index) => mounted && <SidebarMenuSkeleton key={index} />,
                )
              ) : (
                <div className="px-2 py-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    {t("noConversationsYet")}
                  </p>
                </div>
              )}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );

  return (
    <>
      {threadGroupByDate.map((group, index) => {
        const isFirst = index === 0;
        return (
          <SidebarGroup key={group.label}>
            <SidebarGroupContent className="group-data-[collapsible=icon]:hidden group/threads">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarGroupLabel className="">
                    <h4 className="text-xs text-muted-foreground group-hover/threads:text-foreground transition-colors">
                      {group.label}
                    </h4>
                    <div className="flex-1" />
                    {isFirst && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="data-[state=open]:bg-input! opacity-0 data-[state=open]:opacity-100! group-hover/threads:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="right" align="start">
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={handleDeleteAllThreads}
                          >
                            <Trash />
                            {t("deleteAllChats")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={handleDeleteUnarchivedThreads}
                          >
                            <Trash />
                            {t("deleteUnarchivedChats")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </SidebarGroupLabel>

                  <AnimatePresence initial={false}>
                    {group.threads.map((thread) => (
                      <motion.div
                        key={thread.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                      >
                        <SidebarMenuSub className={"group/thread mr-0"}>
                          <SidebarMenuSubItem>
                            <ThreadDropdown
                              side="right"
                              threadId={thread.id}
                              beforeTitle={thread.title}
                            >
                              <div className="flex items-center data-[state=open]:bg-input! group-hover/thread:bg-input! rounded-lg">
                                <Tooltip delayDuration={1000}>
                                  <TooltipTrigger asChild>
                                    <SidebarMenuButton
                                      asChild
                                      className="group-hover/thread:bg-transparent!"
                                      isActive={currentThreadId === thread.id}
                                    >
                                      <Link
                                        href={`/chat/${thread.id}`}
                                        className="flex items-center gap-1.5"
                                        onClick={() => {
                                          if (
                                            pathname !== `/chat/${thread.id}`
                                          ) {
                                            setLoadingThreadId(thread.id);
                                          }
                                        }}
                                      >
                                        {/* Show character icon for roleplay chats */}
                                        {thread.characterId && (
                                          <Sparkles className="size-3 text-pink-500 shrink-0" />
                                        )}
                                        {generatingTitleThreadIds.includes(
                                          thread.id,
                                        ) || loadingThreadId === thread.id ? (
                                          <TextShimmer className="truncate min-w-0">
                                            {thread.title || "New Chat"}
                                          </TextShimmer>
                                        ) : (
                                          <p className="truncate min-w-0">
                                            {thread.title || "New Chat"}
                                          </p>
                                        )}
                                      </Link>
                                    </SidebarMenuButton>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-[200px] p-4 break-all overflow-y-auto max-h-[200px]">
                                    {thread.characterId && (
                                      <span className="text-pink-500 text-xs block mb-1">
                                        🎭 Character Chat
                                      </span>
                                    )}
                                    {thread.title || "New Chat"}
                                  </TooltipContent>
                                </Tooltip>

                                <SidebarMenuAction className="data-[state=open]:bg-input data-[state=open]:opacity-100 opacity-0 group-hover/thread:opacity-100">
                                  <MoreHorizontal />
                                </SidebarMenuAction>
                              </div>
                            </ThreadDropdown>
                          </SidebarMenuSubItem>
                        </SidebarMenuSub>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        );
      })}

      {hasExcessThreads && (
        <SidebarMenu>
          <SidebarMenuItem>
            {/* TODO: Later implement a dedicated search/all chats page instead of this expand functionality */}
            <div className="w-full flex px-4">
              <Button
                variant="secondary"
                size="sm"
                className="w-full hover:bg-input! justify-start"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                <MoreHorizontal className="mr-2" />
                {isExpanded ? t("showLessChats") : t("showAllChats")}
                {isExpanded ? <ChevronUp /> : <ChevronDown />}
              </Button>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      )}
    </>
  );
}
