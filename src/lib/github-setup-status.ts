/**
 * GitHub Database Setup Status Manager
 *
 * Manages the 'hasGitKey' flag and onboarding status for users.
 * This ensures users complete GitHub database setup before using the app.
 */

"use client";

import { useState, useEffect } from "react";

export interface GitHubSetupStatus {
  hasGitKey: boolean;
  repositoryName?: string;
  lastChecked?: string;
  setupCompleted?: boolean;
}

const STORAGE_KEY = "luminar-ai-github-setup";
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get GitHub setup status from local storage
 */
export function getGitHubSetupStatus(userId?: string): GitHubSetupStatus {
  if (typeof window === "undefined") {
    return { hasGitKey: false };
  }

  try {
    const stored = localStorage.getItem(
      `${STORAGE_KEY}-${userId || "anonymous"}`,
    );
    if (!stored) {
      return { hasGitKey: false };
    }

    const status: GitHubSetupStatus = JSON.parse(stored);

    // Check if cache is still valid
    if (status.lastChecked) {
      const lastChecked = new Date(status.lastChecked);
      const now = new Date();

      if (now.getTime() - lastChecked.getTime() > CACHE_DURATION) {
        // Cache expired, need to re-verify
        return { hasGitKey: false };
      }
    }

    return status;
  } catch (error) {
    console.error("Error reading GitHub setup status:", error);
    return { hasGitKey: false };
  }
}

/**
 * Set GitHub setup status in local storage
 */
export function setGitHubSetupStatus(
  userId: string,
  status: GitHubSetupStatus,
): void {
  if (typeof window === "undefined") return;

  try {
    const statusWithTimestamp = {
      ...status,
      lastChecked: new Date().toISOString(),
    };

    localStorage.setItem(
      `${STORAGE_KEY}-${userId}`,
      JSON.stringify(statusWithTimestamp),
    );
  } catch (error) {
    console.error("Error saving GitHub setup status:", error);
  }
}

/**
 * Clear GitHub setup status (for logout or reset)
 */
export function clearGitHubSetupStatus(userId?: string): void {
  if (typeof window === "undefined") return;

  try {
    if (userId) {
      localStorage.removeItem(`${STORAGE_KEY}-${userId}`);
    } else {
      // Clear all setup statuses
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (key.startsWith(STORAGE_KEY)) {
          localStorage.removeItem(key);
        }
      });
    }
  } catch (error) {
    console.error("Error clearing GitHub setup status:", error);
  }
}

/**
 * Hook for managing GitHub setup status
 */
export function useGitHubSetupStatus(userId?: string) {
  const [status, setStatus] = useState<GitHubSetupStatus>(() =>
    getGitHubSetupStatus(userId),
  );

  const updateStatus = (newStatus: Partial<GitHubSetupStatus>) => {
    if (!userId) return;

    const updatedStatus = { ...status, ...newStatus };
    setStatus(updatedStatus);
    setGitHubSetupStatus(userId, updatedStatus);
  };

  const markAsCompleted = (repositoryName: string) => {
    updateStatus({
      hasGitKey: true,
      repositoryName,
      setupCompleted: true,
    });
  };

  const markAsIncomplete = () => {
    updateStatus({
      hasGitKey: false,
      setupCompleted: false,
    });
  };

  const refresh = () => {
    if (userId) {
      setStatus(getGitHubSetupStatus(userId));
    }
  };

  // Re-check status when userId changes
  useEffect(() => {
    if (userId) {
      setStatus(getGitHubSetupStatus(userId));
    }
  }, [userId]);

  return {
    status,
    updateStatus,
    markAsCompleted,
    markAsIncomplete,
    refresh,
  };
}

/**
 * Hook to determine if onboarding should be shown
 */
export function useShowOnboarding(userId?: string): {
  shouldShowOnboarding: boolean;
  isLoading: boolean;
} {
  const [shouldShow, setShouldShow] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setShouldShow(false);
      setIsLoading(false);
      return;
    }

    const status = getGitHubSetupStatus(userId);

    // Show onboarding if hasGitKey is false or setup is not completed
    setShouldShow(!status.hasGitKey || !status.setupCompleted);
    setIsLoading(false);
  }, [userId]);

  return {
    shouldShowOnboarding: shouldShow,
    isLoading,
  };
}
