/**
 * DiffDB Integration Layer
 *
 * This module provides the integration layer between the application
 * and DiffDB. It handles GitHub authentication, repository setup,
 * and provides a unified interface for all DiffDB operations.
 */

import { DiffDBClient } from "./client";
import { DiffDBManager, DiffDBSetupProgress, DiffDBUserSetup } from "./manager";
import { createDiffDBChatRepository } from "./repositories/chat-repository.diffdb";
import { ChatRepository } from "app-types/chat";

export interface DiffDBConfig {
  enabled: boolean;
  accessToken?: string;
  repositoryName?: string;
  onSetupProgress?: (progress: DiffDBSetupProgress) => void;
}

export interface DiffDBState {
  isEnabled: boolean;
  isInitialized: boolean;
  userSetup?: DiffDBUserSetup;
  error?: string;
}

/**
 * Global DiffDB instance management
 */
class DiffDBService {
  private manager: DiffDBManager | null = null;
  private client: DiffDBClient | null = null;
  private isEnabled: boolean = false;
  private isInitialized: boolean = false;
  private setupPromise: Promise<DiffDBUserSetup> | null = null;

  /**
   * Initialize DiffDB with GitHub access token
   */
  async initialize(config: DiffDBConfig): Promise<DiffDBUserSetup> {
    this.isEnabled = config.enabled;

    if (!this.isEnabled) {
      throw new Error("DiffDB is not enabled");
    }

    if (!config.accessToken) {
      throw new Error("GitHub access token is required for DiffDB");
    }

    // Return existing setup promise if already initializing
    if (this.setupPromise) {
      return this.setupPromise;
    }

    // Create new setup promise
    this.setupPromise = this.performSetup(config);

    try {
      const setup = await this.setupPromise;
      this.isInitialized = true;
      return setup;
    } catch (error) {
      this.setupPromise = null; // Allow retry
      throw error;
    }
  }

  private async performSetup(config: DiffDBConfig): Promise<DiffDBUserSetup> {
    const repoName = config.repositoryName || "diffchat-data";

    this.client = new DiffDBClient(config.accessToken!);
    this.manager = new DiffDBManager(config.accessToken!, repoName);

    return await this.manager.setupUser(config.onSetupProgress);
  }

  /**
   * Get DiffDB state
   */
  getState(): DiffDBState {
    return {
      isEnabled: this.isEnabled,
      isInitialized: this.isInitialized,
      userSetup:
        this.manager?.getUserInfo() && this.manager?.getRepositoryInfo()
          ? {
              user: this.manager.getUserInfo()!,
              repository: this.manager.getRepositoryInfo()!,
              isNewRepository: false, // We don't track this after setup
              setupSteps: [],
            }
          : undefined,
    };
  }

  /**
   * Get chat repository (DiffDB or throw if not initialized)
   */
  getChatRepository(): ChatRepository {
    if (!this.isEnabled) {
      throw new Error("DiffDB is not enabled");
    }

    if (!this.isInitialized || !this.client || !this.manager) {
      throw new Error("DiffDB is not initialized");
    }

    return createDiffDBChatRepository(
      this.client,
      this.manager.getRepositoryName(),
    );
  }

  /**
   * Get DiffDB client (for advanced operations)
   */
  getClient(): DiffDBClient {
    if (!this.isEnabled || !this.client) {
      throw new Error("DiffDB client is not available");
    }
    return this.client;
  }

  /**
   * Get DiffDB manager (for user operations)
   */
  getManager(): DiffDBManager {
    if (!this.isEnabled || !this.manager) {
      throw new Error("DiffDB manager is not available");
    }
    return this.manager;
  }

  /**
   * Reset DiffDB state (for testing or re-initialization)
   */
  reset(): void {
    this.manager = null;
    this.client = null;
    this.isInitialized = false;
    this.setupPromise = null;
  }

  /**
   * Check if DiffDB is enabled and ready
   */
  isReady(): boolean {
    return this.isEnabled && this.isInitialized;
  }
}

// Global DiffDB service instance
export const diffdbService = new DiffDBService();

/**
 * Initialize DiffDB with GitHub access token
 * Call this after successful GitHub OAuth
 */
export async function initializeDiffDB(
  accessToken: string,
  options: {
    repositoryName?: string;
    onProgress?: (progress: DiffDBSetupProgress) => void;
  } = {},
): Promise<DiffDBUserSetup> {
  return await diffdbService.initialize({
    enabled: true,
    accessToken,
    repositoryName: options.repositoryName,
    onSetupProgress: options.onProgress,
  });
}

/**
 * Get current DiffDB state
 */
export function getDiffDBState(): DiffDBState {
  return diffdbService.getState();
}

/**
 * Check if DiffDB should be used based on user's auth type
 * DiffDB is enabled when user has a GitHub token (either via OAuth or offline token)
 * Returns false for email/password users (they use PostgreSQL)
 */
export function isDiffDBEnabled(): boolean {
  // Check environment variable first - if explicitly disabled, always false
  if (process.env.DIFFDB_ENABLED === "false") {
    return false;
  }
  // By default, assume DiffDB could be enabled
  // The actual check happens at runtime in repository.ts based on auth type
  return true;
}

/**
 * Check if the current session has GitHub access (DiffDB mode)
 * This is used at runtime to determine storage backend
 */
export async function hasGitHubAccess(): Promise<boolean> {
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();

    // Check for offline token first
    const offlineToken = cookieStore.get("diffchat_offline_token")?.value;
    if (offlineToken) {
      return true;
    }

    // If no offline token, we need to check if the user has GitHub OAuth
    // This will be checked in repository.ts when getting the access token
    return false;
  } catch {
    // Outside request context
    return false;
  }
}

/**
 * Get access token from Better Auth session
 * This should be called from server components with session data
 */
export function getGitHubAccessToken(session: any): string | null {
  // Better Auth stores OAuth tokens in the account data
  // We need to look for the GitHub account and extract the access token
  if (session?.user?.accounts) {
    const githubAccount = session.user.accounts.find(
      (account: any) => account.providerId === "github",
    );
    return githubAccount?.accessToken || null;
  }

  return null;
}

// Export all types and classes for advanced usage
export * from "./client";
export * from "./manager";
export * from "./repositories/chat-repository.diffdb";
