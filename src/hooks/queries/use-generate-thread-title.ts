"use client";

import { appStore } from "@/app/store";
import { useCompletion } from "@ai-sdk/react";
import { ChatModel } from "app-types/chat";
import { useCallback, useEffect } from "react";
import { mutate } from "swr";
import { safe } from "ts-safe";

export function useGenerateThreadTitle(option: {
  threadId: string;
  chatModel?: ChatModel;
}) {
  const { complete, completion, isLoading } = useCompletion({
    api: "/api/chat/title",
  });

  const updateTitle = useCallback(
    (title: string) => {
      appStore.setState((prev) => {
        // Check if thread already exists in the list
        const threadExists = prev.threadList.some(
          (v) => v.id === option.threadId,
        );

        if (!threadExists) {
          // Add to sidebar with current title (even if empty, will show "New Chat")
          return {
            threadList: [
              {
                id: option.threadId,
                title: title || "New Chat",
                userId: "",
                createdAt: new Date(),
              },
              ...prev.threadList,
            ],
          };
        }

        // Thread exists, update its title
        return {
          threadList: prev.threadList.map((v) =>
            v.id === option.threadId ? { ...v, title: title || "New Chat" } : v,
          ),
        };
      });
    },
    [option.threadId],
  );

  const generateTitle = useCallback(
    (message: string) => {
      const { threadId, chatModel } = option;
      if (appStore.getState().generatingTitleThreadIds.includes(threadId))
        return;

      // Add to sidebar immediately with placeholder
      updateTitle("");

      // Mark as generating (triggers shimmer)
      appStore.setState((prev) => ({
        generatingTitleThreadIds: [...prev.generatingTitleThreadIds, threadId],
      }));

      safe(() => {
        return complete("", {
          body: {
            message,
            threadId,
            chatModel: chatModel ?? appStore.getState().chatModel,
          },
        });
      })
        .ifFail(() => {
          // On failure, keep "New Chat"
          updateTitle("New Chat");
        })
        .watch(() => {
          // Completion finished, trigger GitHub sync
          mutate("/api/thread");

          // Remove from generating list after a delay (stops shimmer)
          setTimeout(() => {
            appStore.setState((prev) => ({
              generatingTitleThreadIds: prev.generatingTitleThreadIds.filter(
                (v) => v !== threadId,
              ),
            }));
          }, 300); // Small delay to ensure final title is visible
        });
    },
    [updateTitle, complete, option],
  );

  // Update title as completion streams in
  useEffect(() => {
    const title = completion.trim();
    if (title && !isLoading) {
      // Only update when we have a non-empty title and loading is complete
      updateTitle(title);
    }
  }, [completion, isLoading, updateTitle]);

  return generateTitle;
}
