"use client";

import { useSession as useBetterAuthSession } from "@/lib/auth/hooks";
import { useState, useEffect } from "react";

/**
 * Unified session hook that works for both:
 * - Standard GitHub OAuth users (via better-auth)
 * - Offline users (via cookies)
 */
export function useUnifiedSession() {
  const betterAuthSession = useBetterAuthSession();
  const [offlineUser, setOfflineUser] = useState<any>(null);

  // Check for offline user cookie
  useEffect(() => {
    if (typeof document !== "undefined" && !betterAuthSession.data) {
      const offlineUserCookie = document.cookie
        .split("; ")
        .find((row) => row.startsWith("diffchat_offline_user="));

      if (offlineUserCookie) {
        try {
          const userData = JSON.parse(
            decodeURIComponent(offlineUserCookie.split("=")[1]),
          );
          setOfflineUser({
            user: userData,
            session: {
              id: "offline-session",
              userId: userData.id,
            },
          });
        } catch (e) {
          console.error("Failed to parse offline user cookie", e);
        }
      }
    }
  }, [betterAuthSession.data]);

  // Return better-auth session if available, otherwise offline session
  if (betterAuthSession.data) {
    return betterAuthSession;
  }

  if (offlineUser) {
    return {
      data: offlineUser,
      status: "authenticated" as const,
      error: null,
    };
  }

  return {
    data: null,
    status: betterAuthSession.status,
    error: betterAuthSession.error,
  };
}
