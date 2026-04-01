"use client";
import { appStore } from "@/app/store";
import useSWR, { SWRConfiguration } from "swr";
import { fetcher } from "lib/utils";
import { Agent } from "app-types/agent";

export function useAgents(options?: SWRConfiguration) {
  return useSWR<Omit<Agent, "instructions">[]>("/api/agent", fetcher, {
    errorRetryCount: 1,
    revalidateOnFocus: false,
    fallbackData: [],
    onError: (error) => {
      // Don't show toast for expected errors (auth issues, etc)
      // Just log silently - the UI will handle showing the error state
      console.warn("Failed to load agents:", error?.message || error);
    },
    onSuccess: (data) => {
      // Filter out any corrupted/incomplete agent data
      const validAgents = (data || []).filter((agent) => agent && agent.id);
      appStore.setState({ agentList: validAgents });
    },
    ...options,
  });
}
