"use client";
import useSWR, { SWRConfiguration } from "swr";
import { handleErrorWithToast } from "ui/shared-toast";
import { fetcher } from "lib/utils";
import { PublicAgent } from "@/components/browse-agents/types";

export function usePublicAgents(options?: SWRConfiguration) {
  return useSWR<PublicAgent[]>("/api/agent/public", fetcher, {
    errorRetryCount: 0,
    revalidateOnFocus: false,
    fallbackData: [],
    onError: handleErrorWithToast,
    ...options,
  });
}
