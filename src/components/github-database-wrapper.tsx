/**
 * GitHub Database Initialization Wrapper
 *
 * This wrapper component ensures GitHub/offline users have their GitHub database
 * set up before they can use the app. It shows the onboarding modal
 * when hasGitKey=false.
 *
 * Email/password users SKIP this entirely - they use PostgreSQL.
 */

"use client";

import { useEffect, useState } from "react";
import { useUnifiedSession } from "@/lib/auth/use-unified-session";
import { useUserAuthType } from "@/lib/auth/use-user-auth-type";
import { GitHubOnboardingModal } from "@/components/diffdb-setup-modal";
import {
  useShowOnboarding,
  useGitHubSetupStatus,
} from "@/lib/github-setup-status";
import { isDiffDBEnabled } from "@/lib/diffdb";
import { Loader2 } from "lucide-react";

interface GitHubDatabaseWrapperProps {
  children: React.ReactNode;
}

export function GitHubDatabaseWrapper({
  children,
}: GitHubDatabaseWrapperProps) {
  const { data: session, status } = useUnifiedSession();
  const {
    authType,
    isEmailUser,
    isGitHubUser,
    isLoading: authTypeLoading,
  } = useUserAuthType();
  const userId = session?.user?.id;

  const { shouldShowOnboarding, isLoading: onboardingLoading } =
    useShowOnboarding(userId);
  const { status: setupStatus, markAsCompleted } = useGitHubSetupStatus(userId);

  console.log("[GitHubDatabaseWrapper] Session:", {
    userId,
    status,
    authType,
    isEmailUser,
    isGitHubUser,
  });

  const [appReady, setAppReady] = useState(false);
  const [error, setError] = useState<string>();
  const [silentCheckDone, setSilentCheckDone] = useState(false);

  // Track if app has loaded once in this session to prevent loading flashes
  const [hasLoadedBefore] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("luminar-app-loaded") === "true";
  });

  /**
   * Handle onboarding completion - immediately mark app as ready
   */
  const handleOnboardingComplete = () => {
    setAppReady(true); // Mark app as ready immediately - no waiting for refresh
  };

  /**
   * Handle onboarding errors
   */
  const handleOnboardingError = (error: string) => {
    setError(error);
    console.error("GitHub database setup failed:", error);
  };

  /**
   * EMAIL USERS: Skip DiffDB entirely - they use PostgreSQL
   * This is the key separation of concerns!
   */
  useEffect(() => {
    if (authTypeLoading) return; // Wait for auth type to be determined

    if (isEmailUser) {
      console.log(
        "[GitHubDatabaseWrapper] Email user detected - skipping DiffDB setup",
      );
      setSilentCheckDone(true);
      setAppReady(true);
    }
  }, [isEmailUser, authTypeLoading]);

  /**
   * Silent background check - verify repo exists before showing UI
   * ONLY for GitHub/offline users
   */
  useEffect(() => {
    // Skip for email users - they don't need DiffDB
    if (isEmailUser || authTypeLoading) return;

    if (!userId || silentCheckDone || status !== "authenticated") {
      return;
    }

    // If already marked as complete, skip check
    if (setupStatus.hasGitKey && setupStatus.setupCompleted) {
      setSilentCheckDone(true);
      setAppReady(true);
      return;
    }

    // Do silent background check for GitHub users
    const checkRepo = async () => {
      try {
        const { validateGitHubRepoAction } = await import(
          "@/lib/diffdb/actions"
        );
        const result = await validateGitHubRepoAction();

        if (result.success && result.data?.repositoryExists) {
          // Repo exists! Mark as complete and skip onboarding
          const repoName = result.data.repositoryName || "diffchat-data";
          markAsCompleted(repoName);
          setAppReady(true);
          setSilentCheckDone(true);
          return;
        }
      } catch (error) {
        console.log("Silent repo check failed, will show onboarding:", error);
      }

      // Only mark as done if we didn't find the repo
      setSilentCheckDone(true);
    };

    checkRepo();
  }, [
    userId,
    status,
    silentCheckDone,
    setupStatus,
    markAsCompleted,
    isEmailUser,
    authTypeLoading,
  ]);

  /**
   * Check if app should be ready
   */
  useEffect(() => {
    // Skip all DiffDB checks for email users
    if (isEmailUser) {
      return;
    }

    console.log("[GitHubDatabaseWrapper] useEffect triggered:", {
      isDiffDBEnabled: isDiffDBEnabled(),
      status,
      authType,
      isEmailUser,
      onboardingLoading,
      silentCheckDone,
      userId,
      setupStatus,
    });

    if (!isDiffDBEnabled()) {
      setError("DiffDB is not enabled. Please enable GitHub database storage.");
      return;
    }

    if (
      status === "loading" ||
      onboardingLoading ||
      !silentCheckDone ||
      authTypeLoading
    ) {
      console.log(
        "[GitHubDatabaseWrapper] Still loading/checking, returning early",
      );
      return; // Still loading or checking
    }

    if (status === "unauthenticated") {
      setError("Please sign in to use this app.");
      return;
    }

    if (!userId) {
      console.log("[GitHubDatabaseWrapper] No userId, returning");
      return; // No user ID yet
    }

    console.log("[GitHubDatabaseWrapper] Checking app ready:", {
      userId,
      status,
      authType,
      hasGitKey: setupStatus.hasGitKey,
      setupCompleted: setupStatus.setupCompleted,
      appReady,
      silentCheckDone,
    });

    // If setup is complete, mark app as ready (works for both normal and offline users)
    if (setupStatus.hasGitKey && setupStatus.setupCompleted) {
      setAppReady(true);
      // Mark that app has loaded successfully in this session
      if (typeof window !== "undefined") {
        sessionStorage.setItem("luminar-app-loaded", "true");
      }
    }
  }, [
    status,
    userId,
    setupStatus,
    onboardingLoading,
    silentCheckDone,
    appReady,
    isEmailUser,
    authType,
    authTypeLoading,
  ]);

  /**
   * EMAIL USERS: Skip wrapper entirely - render children immediately
   */
  if (isEmailUser && !authTypeLoading) {
    return <>{children}</>;
  }

  /**
   * Loading state - only show on initial load, not on navigations
   */
  if ((status === "loading" || authTypeLoading) && !hasLoadedBefore) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
          <p className="text-muted-foreground">Authenticating...</p>
        </div>
      </div>
    );
  }

  /**
   * Error state
   */
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto">
            <span className="text-red-500 text-xl">!</span>
          </div>
          <h2 className="text-xl font-semibold">Setup Required</h2>
          <p className="text-muted-foreground">{error}</p>
          {status === "unauthenticated" && (
            <a
              href="/sign-in"
              className="inline-block px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Sign In with GitHub
            </a>
          )}
        </div>
      </div>
    );
  }

  /**
   * App ready - show main content immediately
   */
  if (appReady || (setupStatus.hasGitKey && setupStatus.setupCompleted)) {
    return <>{children}</>;
  }

  /**
   * Show onboarding if needed (only after silent check completes)
   */
  if (shouldShowOnboarding && userId && silentCheckDone) {
    return (
      <GitHubOnboardingModal
        userId={userId}
        onComplete={handleOnboardingComplete}
        onError={handleOnboardingError}
      />
    );
  }

  /**
   * Silent check in progress - don't show loading, will resolve quickly
   */
  if (!silentCheckDone) {
    // Return nothing - the check is fast (<1s), no need to flash loading screen
    return null;
  }

  /**
   * Fallback - should not normally reach here
   */
  console.warn("GitHubDatabaseWrapper: Unexpected state", {
    appReady,
    silentCheckDone,
    shouldShowOnboarding,
    userId,
    setupStatus,
  });

  return <>{children}</>; // Show app as fallback instead of infinite loading
}
