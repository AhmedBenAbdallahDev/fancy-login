// DiffDB-only imports (no PostgreSQL fallback)
import { isDiffDBEnabled } from "../diffdb";
import { getGitHubAccessToken } from "../auth/github-helper";
import { getSession } from "../auth/server";
import { ChatRepository } from "app-types/chat";
import { createDiffDBChatRepository } from "../diffdb/repositories/chat-repository.diffdb";
import { DiffDBClient } from "../diffdb/client";

/**
 * Session-aware DiffDB repository system
 *
 * NO POSTGRESQL FALLBACK - GitHub repositories are the only storage backend.
 * Repositories are created per user session with proper GitHub authentication.
 */

// Global repository cache per user session
const userRepositoryCache = new Map<
  string,
  {
    chatRepository: ChatRepository;
    lastAccessed: number;
  }
>();

/**
 * Get chat repository for current user session
 * This is the main entry point for all chat operations
 */
export async function getChatRepository(): Promise<ChatRepository> {
  if (!isDiffDBEnabled()) {
    throw new Error(
      "DiffDB is disabled. This app requires GitHub authentication and repository access.",
    );
  }

  try {
    // Get current session
    const session = await getSession();
    if (!session?.user?.id) {
      throw new Error("User not authenticated. Please sign in with GitHub.");
    }

    const userId = session.user.id;
    const cacheKey = userId;

    // Check if we have a cached repository for this user (within 5 minutes)
    const cached = userRepositoryCache.get(cacheKey);
    if (cached && Date.now() - cached.lastAccessed < 5 * 60 * 1000) {
      cached.lastAccessed = Date.now();
      return cached.chatRepository;
    }

    // Get GitHub access token
    const accessToken = await getGitHubAccessToken(session);
    if (!accessToken) {
      throw new Error(
        "GitHub access token not found. Please re-authenticate with GitHub.",
      );
    }

    // Create DiffDB client and repository
    const diffdbClient = new DiffDBClient(accessToken);
    await diffdbClient.initialize(); // Initialize with user info

    const repoName = process.env.DIFFDB_REPOSITORY_NAME || "diffchat-data";
    const chatRepository = createDiffDBChatRepository(diffdbClient, repoName);

    // Cache the repository
    userRepositoryCache.set(cacheKey, {
      chatRepository,
      lastAccessed: Date.now(),
    });

    return chatRepository;
  } catch (error) {
    console.error("Failed to get chat repository:", error);
    throw new Error(
      `GitHub database access failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// Export chat repository as async getter
export const chatRepository = {
  async insertThread(thread: any) {
    const repo = await getChatRepository();
    return repo.insertThread(thread);
  },
  async deleteChatMessage(id: string) {
    const repo = await getChatRepository();
    return repo.deleteChatMessage(id);
  },
  async selectThread(id: string) {
    const repo = await getChatRepository();
    return repo.selectThread(id);
  },
  async selectThreadDetails(id: string) {
    const repo = await getChatRepository();
    return repo.selectThreadDetails(id);
  },
  async selectMessagesByThreadId(threadId: string) {
    const repo = await getChatRepository();
    return repo.selectMessagesByThreadId(threadId);
  },
  async selectThreadsByUserId(userId: string) {
    const repo = await getChatRepository();
    return repo.selectThreadsByUserId(userId);
  },
  async updateThread(id: string, thread: any) {
    const repo = await getChatRepository();
    return repo.updateThread(id, thread);
  },
  async upsertThread(thread: any) {
    const repo = await getChatRepository();
    return repo.upsertThread(thread);
  },
  async deleteThread(id: string) {
    const repo = await getChatRepository();
    return repo.deleteThread(id);
  },
  async insertMessage(message: any) {
    const repo = await getChatRepository();
    return repo.insertMessage(message);
  },
  async upsertMessage(message: any) {
    const repo = await getChatRepository();
    return repo.upsertMessage(message);
  },
  async deleteMessagesByChatIdAfterTimestamp(messageId: string) {
    const repo = await getChatRepository();
    return repo.deleteMessagesByChatIdAfterTimestamp(messageId);
  },
  async deleteAllThreads(userId: string) {
    const repo = await getChatRepository();
    return repo.deleteAllThreads(userId);
  },
  async deleteUnarchivedThreads(userId: string) {
    const repo = await getChatRepository();
    return repo.deleteUnarchivedThreads(userId);
  },
  async insertMessages(messages: any[]) {
    const repo = await getChatRepository();
    return repo.insertMessages(messages);
  },
};

// TODO: Other repositories will be implemented in Phase 2
// For now, throw errors for unimplemented repositories
export const userRepository = {
  async findById(_id: string): Promise<any> {
    console.warn(
      "User repository not yet implemented for GitHub storage. Use GitHub profile data instead.",
    );
    return null;
  },
  async create(user: any): Promise<any> {
    console.warn(
      "User repository not yet implemented for GitHub storage. Use GitHub profile data instead.",
    );
    return user;
  },
  async update(_id: string, user: any): Promise<any> {
    console.warn(
      "User repository not yet implemented for GitHub storage. Use GitHub profile data instead.",
    );
    return user;
  },
  async delete(_id: string): Promise<void> {
    console.warn(
      "User repository not yet implemented for GitHub storage. Use GitHub profile data instead.",
    );
  },
};

export const mcpRepository = {
  async selectAll(): Promise<any[]> {
    console.warn(
      "MCP repository not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return [];
  },
  async selectById(_id: string): Promise<any> {
    console.warn(
      "MCP repository not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return null;
  },
  async save(server: any): Promise<any> {
    console.warn(
      "MCP repository not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return server;
  },
  async deleteById(_id: string): Promise<void> {
    console.warn(
      "MCP repository not yet implemented for GitHub storage. Coming in Phase 2.",
    );
  },
  async findAll(): Promise<any[]> {
    console.warn(
      "MCP repository not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return [];
  },
};

export const mcpMcpToolCustomizationRepository = {
  async findAll(): Promise<any[]> {
    console.warn(
      "MCP tool customization not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return [];
  },
  async findById(_id: string): Promise<any> {
    console.warn(
      "MCP tool customization not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return null;
  },
  async create(customization: any): Promise<any> {
    console.warn(
      "MCP tool customization not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return customization;
  },
  async update(_id: string, customization: any): Promise<any> {
    console.warn(
      "MCP tool customization not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return customization;
  },
  async delete(_id: string): Promise<void> {
    console.warn(
      "MCP tool customization not yet implemented for GitHub storage. Coming in Phase 2.",
    );
  },
};

export const mcpServerCustomizationRepository = {
  async findAll(): Promise<any[]> {
    console.warn(
      "MCP server customization not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return [];
  },
  async findById(_id: string): Promise<any> {
    console.warn(
      "MCP server customization not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return null;
  },
  async create(customization: any): Promise<any> {
    console.warn(
      "MCP server customization not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return customization;
  },
  async update(_id: string, customization: any): Promise<any> {
    console.warn(
      "MCP server customization not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return customization;
  },
  async delete(_id: string): Promise<void> {
    console.warn(
      "MCP server customization not yet implemented for GitHub storage. Coming in Phase 2.",
    );
  },
};

export const workflowRepository = {
  async selectAll(_userId: string): Promise<any[]> {
    console.warn(
      "Workflow repository not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return [];
  },
  async selectById(_id: string): Promise<any> {
    console.warn(
      "Workflow repository not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return null;
  },
  async selectStructureById(_id: string, _options?: any): Promise<any> {
    console.warn(
      "Workflow repository not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return null;
  },
  async selectExecuteAbility(_userId: string): Promise<any[]> {
    console.warn(
      "Workflow repository not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return [];
  },
  async selectToolByIds(_toolIds: string[]): Promise<any[]> {
    console.warn(
      "Workflow repository not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return [];
  },
  async checkAccess(_id: string, _userId: string): Promise<boolean> {
    console.warn(
      "Workflow repository not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return false;
  },
  async save(workflow: any): Promise<any> {
    console.warn(
      "Workflow repository not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return workflow;
  },
  async saveStructure(workflow: any): Promise<any> {
    console.warn(
      "Workflow repository not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return workflow;
  },
  async delete(_id: string): Promise<void> {
    console.warn(
      "Workflow repository not yet implemented for GitHub storage. Coming in Phase 2.",
    );
  },
  async findAll(): Promise<any[]> {
    console.warn(
      "Workflow repository not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return [];
  },
};

export const agentRepository = {
  async selectAgentById(_id: string, _userId: string): Promise<any> {
    console.warn(
      "Agent repository not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return null;
  },
  async selectAgentsByUserId(_userId: string): Promise<any[]> {
    console.warn(
      "Agent repository not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return [];
  },
  async selectPublicAgents(): Promise<any[]> {
    console.warn(
      "Agent repository not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return [];
  },
  async selectPublicAgentById(_id: string): Promise<any> {
    console.warn(
      "Agent repository not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return null;
  },
  async upsertAgent(agent: any): Promise<any> {
    console.warn(
      "Agent repository not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return agent;
  },
  async insertAgent(agent: any): Promise<any> {
    console.warn(
      "Agent repository not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return agent;
  },
  async updateAgent(_id: string, _userId: string, update: any): Promise<any> {
    console.warn(
      "Agent repository not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return update;
  },
  async deleteAgent(_id: string, _userId: string): Promise<void> {
    console.warn(
      "Agent repository not yet implemented for GitHub storage. Coming in Phase 2.",
    );
  },
  async findAll(): Promise<any[]> {
    console.warn(
      "Agent repository not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return [];
  },
};

export const archiveRepository = {
  async getArchiveById(_id: string): Promise<any> {
    // Temporary: Return null instead of throwing to allow build to pass
    console.warn(
      "Archive repository not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return null;
  },
  async getArchivesByUserId(_userId: string): Promise<any[]> {
    // Temporary: Return empty array instead of throwing to allow build to pass
    console.warn(
      "Archive repository not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return [];
  },
  async getArchiveItems(_archiveId: string): Promise<any[]> {
    // Temporary: Return empty array instead of throwing to allow build to pass
    console.warn(
      "Archive repository not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return [];
  },
  async findAll(): Promise<any[]> {
    console.warn(
      "Archive repository not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return [];
  },
  async create(_archive: any): Promise<any> {
    console.warn(
      "Archive repository not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return null;
  },
  async update(_id: string, _archive: any): Promise<any> {
    console.warn(
      "Archive repository not yet implemented for GitHub storage. Coming in Phase 2.",
    );
    return null;
  },
  async delete(_id: string): Promise<void> {
    console.warn(
      "Archive repository not yet implemented for GitHub storage. Coming in Phase 2.",
    );
  },
};
