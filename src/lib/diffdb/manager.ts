/**
 * DiffDB Manager - Repository Management and User Onboarding
 *
 * This module handles user repository setup, initialization,
 * and provides high-level operations for DiffDB management.
 */

import { DiffDBClient, GitHubUserInfo, DiffDBRepositoryInfo } from "./client";

export interface DiffDBUserSetup {
  user: GitHubUserInfo;
  repository: DiffDBRepositoryInfo;
  isNewRepository: boolean;
  setupSteps: string[];
}

export interface DiffDBSetupProgress {
  step: string;
  description: string;
  completed: boolean;
  error?: string;
}

/**
 * High-level manager for DiffDB operations
 */
export class DiffDBManager {
  private client: DiffDBClient;
  private repoName: string;
  private userInfo: GitHubUserInfo | null = null;
  private repositoryInfo: DiffDBRepositoryInfo | null = null;

  constructor(accessToken: string, repoName: string = "diffchat-data") {
    this.client = new DiffDBClient(accessToken);
    this.repoName = repoName;
  }

  /**
   * Initialize user's DiffDB setup with progress tracking
   */
  async setupUser(
    onProgress?: (progress: DiffDBSetupProgress) => void,
  ): Promise<DiffDBUserSetup> {
    const setupSteps: string[] = [];
    let isNewRepository = false;

    const updateProgress = (
      step: string,
      description: string,
      completed: boolean = true,
      error?: string,
    ) => {
      if (onProgress) {
        onProgress({ step, description, completed, error });
      }
      if (completed && !error) {
        setupSteps.push(step);
      }
    };

    try {
      // Step 1: Initialize GitHub API client
      updateProgress("auth", "Authenticating with GitHub...", false);
      this.userInfo = await this.client.initialize();
      updateProgress("auth", "GitHub authentication successful");

      // Step 2: Check repository access
      updateProgress("access", "Testing repository permissions...", false);
      const accessTest = await this.client.testAccess();
      if (!accessTest.success) {
        throw new Error(`GitHub access test failed: ${accessTest.error}`);
      }
      updateProgress("access", "Repository permissions confirmed");

      // Step 3: Check if repository exists
      updateProgress("repo-check", "Checking for existing database...", false);
      const repoExists = await this.client.repositoryExists(this.repoName);

      if (!repoExists) {
        isNewRepository = true;

        // Step 4: Create repository
        updateProgress(
          "repo-create",
          "Creating your personal database repository...",
          false,
        );
        this.repositoryInfo = await this.client.createRepository(
          this.repoName,
          `Personal DiffChat database for ${this.userInfo.login}`,
        );
        updateProgress("repo-create", "Database repository created");

        // Step 5: Initialize structure
        updateProgress("structure", "Setting up database structure...", false);
        await this.client.initializeDiffDBStructure(this.repoName);
        updateProgress("structure", "Database structure initialized");

        // Step 6: Create user profile
        updateProgress("profile", "Creating your user profile...", false);
        await this.createInitialUserProfile();
        updateProgress("profile", "User profile created");
      } else {
        // Repository exists, get its info
        updateProgress("repo-check", "Connecting to existing database...");
        this.repositoryInfo = await this.client.getRepository(this.repoName);

        // Verify structure exists, create if missing
        updateProgress("verify", "Verifying database structure...", false);
        await this.verifyAndFixStructure();
        updateProgress("verify", "Database structure verified");
      }

      // Final step: Ready to use
      updateProgress("ready", "Database ready for use!");

      return {
        user: this.userInfo,
        repository: this.repositoryInfo!,
        isNewRepository,
        setupSteps,
      };
    } catch (error: any) {
      updateProgress(
        "error",
        `Setup failed: ${error.message}`,
        false,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Create initial user profile in the repository
   */
  private async createInitialUserProfile(): Promise<void> {
    if (!this.userInfo) {
      throw new Error("User info not available");
    }

    const userProfile = {
      id: this.userInfo.id.toString(),
      login: this.userInfo.login,
      name: this.userInfo.name,
      email: this.userInfo.email,
      avatar_url: this.userInfo.avatar_url,
      preferences: {
        theme: "dark",
        language: "en",
        notifications: true,
      },
      diffdb: {
        version: "1.0.0",
        repository: this.repositoryInfo?.full_name,
        created_at: new Date().toISOString(),
        last_accessed: new Date().toISOString(),
      },
    };

    const profilePath = `users/user-${this.userInfo.id}.json`;
    await this.client.writeFile(
      this.repoName,
      profilePath,
      JSON.stringify(userProfile, null, 2),
      "Create initial user profile",
    );
  }

  /**
   * Verify database structure and fix if needed
   */
  private async verifyAndFixStructure(): Promise<void> {
    try {
      // Check if schema.json exists
      const schema = await this.client.readFile(this.repoName, "schema.json");
      if (!schema) {
        // Initialize structure if missing
        await this.client.initializeDiffDBStructure(this.repoName);
      }

      // Verify required directories exist
      const requiredDirs = [
        "users",
        "sessions",
        "threads",
        "messages",
        "agents",
        "mcp_servers",
        "workflows",
        "archives",
      ];

      for (const dir of requiredDirs) {
        const keepFile = `${dir}/.gitkeep`;
        const exists = await this.client.readFile(this.repoName, keepFile);
        if (!exists) {
          const keepContent = `# ${dir.charAt(0).toUpperCase() + dir.slice(1)} directory\n\nThis directory stores ${dir.replace("_", " ")} data for DiffChat.\n`;
          await this.client.writeFile(
            this.repoName,
            keepFile,
            keepContent,
            `Restore ${dir} directory`,
          );
        }
      }
    } catch (error) {
      throw new Error(`Failed to verify database structure: ${error}`);
    }
  }

  /**
   * Get current user info
   */
  getUserInfo(): GitHubUserInfo | null {
    return this.userInfo;
  }

  /**
   * Get repository info
   */
  getRepositoryInfo(): DiffDBRepositoryInfo | null {
    return this.repositoryInfo;
  }

  /**
   * Get repository name
   */
  getRepositoryName(): string {
    return this.repoName;
  }

  /**
   * Get underlying DiffDB client
   */
  getClient(): DiffDBClient {
    return this.client;
  }

  /**
   * Check if DiffDB is properly initialized
   */
  isInitialized(): boolean {
    return this.userInfo !== null && this.repositoryInfo !== null;
  }

  /**
   * Update user's last accessed timestamp
   */
  async updateLastAccessed(): Promise<void> {
    if (!this.userInfo) {
      throw new Error("User not initialized");
    }

    try {
      const profilePath = `users/user-${this.userInfo.id}.json`;
      const existingProfile = await this.client.readFile(
        this.repoName,
        profilePath,
      );

      if (existingProfile) {
        const profile = JSON.parse(existingProfile.content);
        profile.diffdb.last_accessed = new Date().toISOString();

        await this.client.writeFile(
          this.repoName,
          profilePath,
          JSON.stringify(profile, null, 2),
          "Update last accessed timestamp",
          existingProfile.sha,
        );
      }
    } catch (error) {
      // Log error but don't fail - this is not critical
      console.warn("Failed to update last accessed timestamp:", error);
    }
  }

  /**
   * Get user stats from repository
   */
  async getUserStats(): Promise<{
    totalThreads: number;
    totalMessages: number;
    totalAgents: number;
    totalWorkflows: number;
    repositorySize: number;
    lastActivity: string | null;
  }> {
    try {
      const [threads, agents, workflows] = await Promise.all([
        this.client.listDirectory(this.repoName, "threads"),
        this.client.listDirectory(this.repoName, "agents"),
        this.client.listDirectory(this.repoName, "workflows"),
      ]);

      // Count messages across all thread directories
      let totalMessages = 0;
      for (const thread of threads) {
        if (thread.type === "dir") {
          const messages = await this.client.listDirectory(
            this.repoName,
            `messages/${thread.name}`,
          );
          totalMessages += messages.length;
        }
      }

      // Get repository info for size and last activity
      const repoInfo = await this.client.getRepository(this.repoName);

      return {
        totalThreads: threads.filter((f) => f.name.endsWith(".json")).length,
        totalMessages,
        totalAgents: agents.filter((f) => f.name.endsWith(".json")).length,
        totalWorkflows: workflows.filter((f) => f.name.endsWith(".json"))
          .length,
        repositorySize: 0, // GitHub API doesn't provide this easily
        lastActivity: repoInfo.updated_at,
      };
    } catch (error) {
      throw new Error(`Failed to get user stats: ${error}`);
    }
  }
}
