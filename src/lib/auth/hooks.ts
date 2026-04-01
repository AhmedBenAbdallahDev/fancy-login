/**
 * Better Auth Session Hook
 *
 * Custom hooks for managing authentication state with Better Auth
 */

"use client";

import { useEffect, useState } from "react";
import { authClient } from "./client";

export interface SessionData {
  user?: {
    id: string;
    name?: string;
    email?: string;
    image?: string;
  };
  session?: {
    id: string;
    token: string;
    expiresAt: Date;
  };
}

export interface UseSessionResult {
  data: SessionData | null;
  status: "loading" | "authenticated" | "unauthenticated";
  error?: Error;
}

/**
 * Hook to get current session state
 */
export function useSession(): UseSessionResult {
  const [data, setData] = useState<SessionData | null>(null);
  const [status, setStatus] = useState<
    "loading" | "authenticated" | "unauthenticated"
  >("loading");
  const [error, setError] = useState<Error>();

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        setStatus("loading");
        setError(undefined);

        // Use Better Auth client to get session
        const session = await authClient.getSession();

        if (!mounted) return;

        if (session?.data?.user) {
          setData({
            user: {
              id: session.data.user.id,
              name: session.data.user.name || undefined,
              email: session.data.user.email || undefined,
              image: session.data.user.image || undefined,
            },
            session: session.data.session
              ? {
                  id: session.data.session.id,
                  token: session.data.session.token,
                  expiresAt: new Date(session.data.session.expiresAt),
                }
              : undefined,
          });
          setStatus("authenticated");
        } else {
          setData(null);
          setStatus("unauthenticated");
        }
      } catch (err) {
        if (!mounted) return;

        setError(
          err instanceof Error ? err : new Error("Session check failed"),
        );
        setData(null);
        setStatus("unauthenticated");
      }
    };

    checkSession();

    // No periodic checking - check once on startup and trust until API failure
    // If GitHub API returns 401, the error handling will redirect to sign-in

    return () => {
      mounted = false;
    };
  }, []);

  return { data, status, error };
}

/**
 * Hook to check if user is authenticated
 */
export function useAuth() {
  const { data, status, error } = useSession();

  return {
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    user: data?.user,
    session: data?.session,
    error,
  };
}
