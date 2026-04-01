/**
 * DiffDB Initialization Hook
 *
 * This hook handles DiffDB setup after GitHub authentication.
 * It provides progress tracking and error handling for the setup process.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  initializeDiffDB,
  getDiffDBState,
  isDiffDBEnabled,
  DiffDBSetupProgress,
  DiffDBUserSetup,
  DiffDBState,
} from "@/lib/diffdb";

export interface UseDiffDBOptions {
  accessToken?: string;
  repositoryName?: string;
  autoInitialize?: boolean;
}

export interface UseDiffDBResult {
  state: DiffDBState;
  setup?: DiffDBUserSetup;
  progress?: DiffDBSetupProgress;
  isLoading: boolean;
  error?: string;
  initialize: (accessToken: string, repositoryName?: string) => Promise<void>;
  retry: () => Promise<void>;
}

/**
 * Hook for managing DiffDB initialization and state
 */
export function useDiffDB(options: UseDiffDBOptions = {}): UseDiffDBResult {
  const [state, setState] = useState<DiffDBState>(() => getDiffDBState());
  const [setup, setSetup] = useState<DiffDBUserSetup>();
  const [progress, setProgress] = useState<DiffDBSetupProgress>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();

  // Track the current access token for retries
  const [currentAccessToken, setCurrentAccessToken] = useState<string>();
  const [currentRepoName, setCurrentRepoName] = useState<string>();

  /**
   * Initialize DiffDB with progress tracking
   */
  const initialize = useCallback(
    async (accessToken: string, repositoryName?: string) => {
      if (!isDiffDBEnabled()) {
        setError("DiffDB is not enabled in environment variables");
        return;
      }

      setIsLoading(true);
      setError(undefined);
      setProgress(undefined);
      setCurrentAccessToken(accessToken);
      setCurrentRepoName(repositoryName);

      try {
        const setupResult = await initializeDiffDB(accessToken, {
          repositoryName,
          onProgress: (progressUpdate) => {
            setProgress(progressUpdate);
            if (progressUpdate.error) {
              setError(progressUpdate.error);
            }
          },
        });

        setSetup(setupResult);
        setState(getDiffDBState());
        setProgress({
          step: "complete",
          description: "DiffDB initialization complete!",
          completed: true,
        });
      } catch (err: any) {
        setError(err.message || "Failed to initialize DiffDB");
        console.error("DiffDB initialization failed:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  /**
   * Retry initialization with the last used parameters
   */
  const retry = useCallback(async () => {
    if (currentAccessToken) {
      await initialize(currentAccessToken, currentRepoName);
    } else {
      setError("No access token available for retry");
    }
  }, [initialize, currentAccessToken, currentRepoName]);

  /**
   * Auto-initialize if access token is provided
   */
  useEffect(() => {
    if (
      options.autoInitialize &&
      options.accessToken &&
      !state.isInitialized &&
      !isLoading
    ) {
      initialize(options.accessToken, options.repositoryName);
    }
  }, [
    options.autoInitialize,
    options.accessToken,
    options.repositoryName,
    state.isInitialized,
    isLoading,
    initialize,
  ]);

  /**
   * Update state when DiffDB state changes externally
   */
  useEffect(() => {
    const interval = setInterval(() => {
      const newState = getDiffDBState();
      if (JSON.stringify(newState) !== JSON.stringify(state)) {
        setState(newState);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [state]);

  return {
    state,
    setup,
    progress,
    isLoading,
    error,
    initialize,
    retry,
  };
}

/**
 * Simple hook to check if DiffDB is ready
 */
export function useDiffDBReady(): boolean {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const checkReady = () => {
      const state = getDiffDBState();
      setIsReady(state.isEnabled && state.isInitialized);
    };

    checkReady();
    const interval = setInterval(checkReady, 1000);
    return () => clearInterval(interval);
  }, []);

  return isReady;
}
