"use client";

import useSWR from "swr";
import { fetcher } from "lib/utils";

interface UserAuthTypeResponse {
  authType: "github" | "email" | "offline" | null;
  storageMode: "diffdb" | "postgres" | null;
}

/**
 * Hook to get the current user's authentication type
 *
 * Returns:
 * - authType: "github" | "email" | "offline" | null
 * - storageMode: "diffdb" | "postgres" | null
 * - isGitHubUser: true if user needs DiffDB (GitHub or offline)
 * - isEmailUser: true if user uses PostgreSQL
 */
export function useUserAuthType() {
  const { data, error, isLoading } = useSWR<UserAuthTypeResponse>(
    "/api/auth/user-auth-type",
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // Cache for 1 minute
    },
  );

  return {
    authType: data?.authType ?? null,
    storageMode: data?.storageMode ?? null,
    isGitHubUser: data?.authType === "github" || data?.authType === "offline",
    isEmailUser: data?.authType === "email",
    isLoading,
    error,
  };
}
