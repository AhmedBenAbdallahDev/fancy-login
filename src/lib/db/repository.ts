// DiffDB + PostgreSQL dual-mode repository system
import { getGitHubAccessToken } from "../auth/github-helper";
import { getSession } from "../auth/server";
import { ChatRepository } from "app-types/chat";
import { createDiffDBChatRepository } from "../diffdb/repositories/chat-repository.diffdb";
import { createDiffDBArchiveRepository } from "../diffdb/repositories/archive-repository.diffdb";
import { createDiffDBUserRepository } from "../diffdb/repositories/user-repository.diffdb";
import { createDiffDBMcpRepository } from "../diffdb/repositories/mcp-repository.diffdb";
import { createDiffDBMcpServerCustomizationRepository } from "../diffdb/repositories/mcp-server-customization-repository.diffdb";
import { createDiffDBMcpToolCustomizationRepository } from "../diffdb/repositories/mcp-tool-customization-repository.diffdb";
import { createDiffDBWorkflowRepository } from "../diffdb/repositories/workflow-repository.diffdb";
// Agent repository always uses PostgreSQL for public marketplace/discoverability
import { DiffDBClient } from "../diffdb/client";

// PostgreSQL repositories
import { pgChatRepository } from "./pg/repositories/chat-repository.pg";
import { pgUserRepository } from "./pg/repositories/user-repository.pg";
import { pgArchiveRepository } from "./pg/repositories/archive-repository.pg";
import { pgMcpRepository } from "./pg/repositories/mcp-repository.pg";
import { pgMcpServerCustomizationRepository } from "./pg/repositories/mcp-server-customization-repository.pg";
import { pgMcpMcpToolCustomizationRepository } from "./pg/repositories/mcp-tool-customization-repository.pg";
import { pgWorkflowRepository } from "./pg/repositories/workflow-repository.pg";
import { pgAgentRepository } from "./pg/repositories/agent-repository.pg";

// Character chat repositories (always PostgreSQL for discoverability)
import { pgPersonaRepository } from "./pg/repositories/persona-repository.pg";
import { pgCharacterRepository } from "./pg/repositories/character-repository.pg";
import { pgStylePresetRepository } from "./pg/repositories/style-preset-repository.pg";
import { pgCreatorProfileRepository } from "./pg/repositories/creator-profile-repository.pg";
import { pgLorebookRepository } from "./pg/repositories/lorebook-repository.pg";

/**
 * Dual-mode repository system
 *
 * - GitHub users (OAuth or token): Use DiffDB (GitHub repository storage)
 * - Email/Password users: Use PostgreSQL
 *
 * The storage mode is determined at runtime based on the user's authentication type.
 */

// Global repository cache per user session
const userRepositoryCache = new Map<
  string,
  {
    mode: "diffdb" | "postgres";
    chatRepository: ChatRepository;
    archiveRepository: any;
    userRepository: any;
    mcpRepository: any;
    mcpServerCustomizationRepository: any;
    mcpToolCustomizationRepository: any;
    workflowRepository: any;
    agentRepository: any;
    lastAccessed: number;
  }
>();

/**
 * Determine the storage mode for the current user
 */
async function getStorageMode(): Promise<{
  mode: "diffdb" | "postgres";
  accessToken?: string;
  userId: string;
}> {
  try {
    // 1. Check for offline token first (DiffDB mode)
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const offlineToken = cookieStore.get("diffchat_offline_token")?.value;
    const offlineUserStr = cookieStore.get("diffchat_offline_user")?.value;

    if (offlineToken && offlineUserStr) {
      const offlineUser = JSON.parse(offlineUserStr);
      return {
        mode: "diffdb",
        accessToken: offlineToken,
        userId: offlineUser.id,
      };
    }

    // 2. Get Better Auth session
    const session = await getSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }

    // 3. Check if user has GitHub OAuth (DiffDB mode)
    const githubToken = await getGitHubAccessToken(session);
    if (githubToken) {
      return {
        mode: "diffdb",
        accessToken: githubToken,
        userId: session.user.id,
      };
    }

    // 4. No GitHub token = email/password user (PostgreSQL mode)
    return { mode: "postgres", userId: session.user.id };
  } catch (error) {
    console.error("Failed to determine storage mode:", error);
    throw error;
  }
}

/**
 * Get repositories for current user session
 * Automatically selects DiffDB or PostgreSQL based on user's auth type
 */
async function getUserRepositories() {
  try {
    const { mode, accessToken, userId } = await getStorageMode();
    const cacheKey = `${userId}-${mode}`;

    // Check if we have cached repositories for this user (within 5 minutes)
    const cached = userRepositoryCache.get(cacheKey);
    if (cached && Date.now() - cached.lastAccessed < 5 * 60 * 1000) {
      cached.lastAccessed = Date.now();
      return cached;
    }

    let repositories;

    if (mode === "diffdb" && accessToken) {
      // DiffDB mode - GitHub repository storage for personal data
      // BUT agents are always in PostgreSQL for discoverability
      const diffdbClient = new DiffDBClient(accessToken);
      await diffdbClient.initialize();

      const repoName = process.env.DIFFDB_REPOSITORY_NAME || "diffchat-data";

      repositories = {
        mode: "diffdb" as const,
        // Personal data -> GitHub
        chatRepository: createDiffDBChatRepository(diffdbClient, repoName),
        archiveRepository: createDiffDBArchiveRepository(
          diffdbClient,
          repoName,
        ),
        userRepository: createDiffDBUserRepository(diffdbClient, repoName),
        mcpRepository: createDiffDBMcpRepository(diffdbClient, repoName),
        mcpServerCustomizationRepository:
          createDiffDBMcpServerCustomizationRepository(diffdbClient, repoName),
        mcpToolCustomizationRepository:
          createDiffDBMcpToolCustomizationRepository(diffdbClient, repoName),
        workflowRepository: createDiffDBWorkflowRepository(
          diffdbClient,
          repoName,
        ),
        // Agents ALWAYS in PostgreSQL - for public marketplace & discoverability
        agentRepository: pgAgentRepository,
        lastAccessed: Date.now(),
      };
    } else {
      // PostgreSQL mode - traditional database storage
      repositories = {
        mode: "postgres" as const,
        chatRepository: pgChatRepository,
        archiveRepository: pgArchiveRepository,
        userRepository: pgUserRepository,
        mcpRepository: pgMcpRepository,
        mcpServerCustomizationRepository: pgMcpServerCustomizationRepository,
        mcpToolCustomizationRepository: pgMcpMcpToolCustomizationRepository,
        workflowRepository: pgWorkflowRepository,
        agentRepository: pgAgentRepository,
        lastAccessed: Date.now(),
      };
    }

    // Cache the repositories
    userRepositoryCache.set(cacheKey, repositories);

    return repositories;
  } catch (error) {
    console.error("Failed to get user repositories:", error);
    throw new Error(
      `Database access failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Create async repository proxy that resolves at runtime
 */
function createRepositoryProxy<T extends object>(
  getRepository: () => Promise<T>,
): T {
  return new Proxy<T>({} as T, {
    get(_target, prop) {
      return async (...args: any[]) => {
        const repo = await getRepository();
        const method = (repo as any)[prop];
        if (typeof method === "function") {
          return method.apply(repo, args);
        }
        return method;
      };
    },
  });
}

// Export all repositories as async proxies that resolve at runtime
export const chatRepository = createRepositoryProxy(async () => {
  const repos = await getUserRepositories();
  return repos.chatRepository;
});

export const archiveRepository = createRepositoryProxy(async () => {
  const repos = await getUserRepositories();
  return repos.archiveRepository;
});

export const userRepository = createRepositoryProxy(async () => {
  const repos = await getUserRepositories();
  return repos.userRepository;
});

export const mcpRepository = createRepositoryProxy(async () => {
  const repos = await getUserRepositories();
  return repos.mcpRepository;
});

export const workflowRepository = createRepositoryProxy(async () => {
  const repos = await getUserRepositories();
  return repos.workflowRepository;
});

export const mcpMcpToolCustomizationRepository = createRepositoryProxy(
  async () => {
    const repos = await getUserRepositories();
    return repos.mcpToolCustomizationRepository;
  },
);

export const mcpServerCustomizationRepository = createRepositoryProxy(
  async () => {
    const repos = await getUserRepositories();
    return repos.mcpServerCustomizationRepository;
  },
);

// ============================================================================
// CHARACTER CHAT SYSTEM REPOSITORIES
// These are always PostgreSQL for discoverability and sharing
// ============================================================================

export const personaRepository = pgPersonaRepository;
export const characterRepository = pgCharacterRepository;
export const stylePresetRepository = pgStylePresetRepository;
export const creatorProfileRepository = pgCreatorProfileRepository;
export const lorebookRepository = pgLorebookRepository;

// ============================================================================
// AGENT REPOSITORY - Always PostgreSQL for public marketplace & discoverability
// ============================================================================
export const agentRepository = pgAgentRepository;
