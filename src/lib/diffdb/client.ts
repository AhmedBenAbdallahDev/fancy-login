/**
 * DiffDB GitHub API Client - Foundation Layer
 *
 * This module provides the core GitHub API operations for DiffDB.
 * It handles repository management, file operations, and authentication
 * required for using GitHub repositories as a database backend.
 */

import { Octokit } from "@octokit/rest";

export interface GitHubUserInfo {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  html_url: string;
}

export interface GitHubFileInfo {
  path: string;
  content: string;
  sha: string;
  size: number;
  download_url: string | null;
}

export interface DiffDBRepositoryInfo {
  name: string;
  full_name: string;
  owner: string;
  private: boolean;
  html_url: string;
  clone_url: string;
  created_at: string;
  updated_at: string;
}

export interface DiffDBCommitResult {
  sha: string;
  message: string;
  path: string;
  size: number;
}

/**
 * Core GitHub API client for DiffDB operations
 */
export class DiffDBClient {
  private octokit: Octokit;
  private username: string | null = null;

  constructor(accessToken: string) {
    this.octokit = new Octokit({
      auth: accessToken,
      userAgent: "Luminar-AI-DiffDB/1.0",
      request: {
        timeout: 10000, // 10 second timeout
        retries: 2, // Retry failed requests twice
      },
    });
  }

  /**
   * Initialize client with user information
   */
  async initialize(): Promise<GitHubUserInfo> {
    const userInfo = await this.getAuthenticatedUser();
    this.username = userInfo.login;
    return userInfo;
  }

  /**
   * Get authenticated user information
   */
  async getAuthenticatedUser(): Promise<GitHubUserInfo> {
    try {
      const { data } = await this.octokit.users.getAuthenticated();
      return {
        id: data.id,
        login: data.login,
        name: data.name,
        email: data.email,
        avatar_url: data.avatar_url,
        html_url: data.html_url,
      };
    } catch (error) {
      throw new Error(`Failed to get authenticated user: ${error}`);
    }
  }

  /**
   * Check if repository exists
   */
  async repositoryExists(repoName: string): Promise<boolean> {
    if (!this.username) {
      await this.initialize();
    }

    try {
      await this.octokit.repos.get({
        owner: this.username!,
        repo: repoName,
      });
      return true;
    } catch (error: any) {
      if (error.status === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Create a new private repository
   */
  async createRepository(
    repoName: string,
    description?: string,
  ): Promise<DiffDBRepositoryInfo> {
    try {
      const { data } = await this.octokit.repos.createForAuthenticatedUser({
        name: repoName,
        private: true,
        description:
          description || `DiffDB Data Storage - ${new Date().toISOString()}`,
        auto_init: false, // Don't auto-create README - we'll create our own structure
      });

      return {
        name: data.name,
        full_name: data.full_name,
        owner: data.owner.login,
        private: data.private,
        html_url: data.html_url,
        clone_url: data.clone_url,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    } catch (error: any) {
      if (
        error.status === 422 &&
        error.message?.includes("name already exists")
      ) {
        // Repository exists, get its info
        return await this.getRepository(repoName);
      }
      throw new Error(`Failed to create repository: ${error.message}`);
    }
  }

  /**
   * Get repository information
   */
  async getRepository(repoName: string): Promise<DiffDBRepositoryInfo> {
    if (!this.username) {
      await this.initialize();
    }

    try {
      const { data } = await this.octokit.repos.get({
        owner: this.username!,
        repo: repoName,
      });

      return {
        name: data.name,
        full_name: data.full_name,
        owner: data.owner.login,
        private: data.private,
        html_url: data.html_url,
        clone_url: data.clone_url,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    } catch (error) {
      throw new Error(`Failed to get repository: ${error}`);
    }
  }

  /**
   * Read file content from repository
   */
  async readFile(
    repoName: string,
    filePath: string,
  ): Promise<GitHubFileInfo | null> {
    if (!this.username) {
      await this.initialize();
    }

    try {
      const { data } = (await this.octokit.repos.getContent({
        owner: this.username!,
        repo: repoName,
        path: filePath,
      })) as { data: any };

      if (data.type !== "file") {
        throw new Error(`${filePath} is not a file`);
      }

      const content = Buffer.from(data.content, "base64").toString("utf8");

      return {
        path: data.path,
        content,
        sha: data.sha,
        size: data.size,
        download_url: data.download_url,
      };
    } catch (error: any) {
      if (error.status === 404) {
        return null; // File doesn't exist
      }
      throw new Error(`Failed to read file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Create or update a file in repository
   */
  async writeFile(
    repoName: string,
    filePath: string,
    content: string,
    commitMessage?: string,
    sha?: string,
  ): Promise<DiffDBCommitResult> {
    if (!this.username) {
      await this.initialize();
    }

    try {
      const message =
        commitMessage || `${sha ? "Update" : "Create"} ${filePath}`;
      const encodedContent = Buffer.from(content, "utf8").toString("base64");

      const params: any = {
        owner: this.username!,
        repo: repoName,
        path: filePath,
        message: message,
        content: encodedContent,
      };

      // Include SHA if updating existing file
      if (sha) {
        params.sha = sha;
      }

      const { data } =
        await this.octokit.repos.createOrUpdateFileContents(params);

      return {
        sha: data.commit.sha || "",
        message: data.commit.message || message,
        path: data.content?.path || filePath,
        size: data.content?.size || 0,
      };
    } catch (error) {
      throw new Error(`Failed to write file ${filePath}: ${error}`);
    }
  }

  /**
   * Delete a file from repository
   */
  async deleteFile(
    repoName: string,
    filePath: string,
    commitMessage?: string,
  ): Promise<void> {
    if (!this.username) {
      await this.initialize();
    }

    try {
      // Get file SHA first
      const fileInfo = await this.readFile(repoName, filePath);
      if (!fileInfo) {
        throw new Error(`File ${filePath} not found`);
      }

      const message = commitMessage || `Delete ${filePath}`;

      await this.octokit.repos.deleteFile({
        owner: this.username!,
        repo: repoName,
        path: filePath,
        message: message,
        sha: fileInfo.sha,
      });
    } catch (error) {
      throw new Error(`Failed to delete file ${filePath}: ${error}`);
    }
  }

  /**
   * List directory contents
   */
  async listDirectory(
    repoName: string,
    dirPath: string = "",
  ): Promise<
    Array<{
      name: string;
      path: string;
      type: "file" | "dir";
      size: number;
      sha: string;
    }>
  > {
    if (!this.username) {
      await this.initialize();
    }

    try {
      const { data } = (await this.octokit.repos.getContent({
        owner: this.username!,
        repo: repoName,
        path: dirPath,
      })) as { data: any };

      if (Array.isArray(data)) {
        return data.map((item: any) => ({
          name: item.name,
          path: item.path,
          type: item.type === "dir" ? "dir" : "file",
          size: item.size || 0,
          sha: item.sha,
        }));
      } else {
        // Single file
        return [
          {
            name: data.name,
            path: data.path,
            type: data.type === "dir" ? "dir" : "file",
            size: data.size || 0,
            sha: data.sha,
          },
        ];
      }
    } catch (error: any) {
      if (error.status === 404) {
        return []; // Directory doesn't exist or is empty
      }
      throw new Error(`Failed to list directory ${dirPath}: ${error.message}`);
    }
  }

  /**
   * Initialize repository with DiffDB structure
   */
  async initializeDiffDBStructure(repoName: string): Promise<void> {
    if (!this.username) {
      await this.initialize();
    }

    try {
      // Create schema.json with metadata
      const schemaContent = JSON.stringify(
        {
          version: "1.0.0",
          created_at: new Date().toISOString(),
          description: "DiffDB Repository",
          structure: {
            users: "User profiles and preferences",
            sessions: "Active user sessions",
            threads: "Chat thread metadata",
            messages: "Chat messages organized by thread",
            agents: "Custom AI agents",
            mcp_servers: "MCP server configurations",
            workflows: "Custom workflow definitions",
            archives: "Archived conversations",
          },
        },
        null,
        2,
      );

      await this.writeFile(
        repoName,
        "schema.json",
        schemaContent,
        "Initialize DiffDB schema",
      );

      // Create directory structure with .gitkeep files
      const directories = [
        "users",
        "sessions",
        "threads",
        "messages",
        "agents",
        "mcp_servers",
        "workflows",
        "archives",
        "_metadata",
      ];

      for (const dir of directories) {
        const keepFile = `${dir}/.gitkeep`;
        const keepContent = `# ${dir.charAt(0).toUpperCase() + dir.slice(1)} directory\n\nThis directory stores ${dir.replace("_", " ")} data for DiffChat.\n`;
        await this.writeFile(
          repoName,
          keepFile,
          keepContent,
          `Initialize ${dir} directory`,
        );
      }

      // Create README
      const readmeContent = `# DiffChat - Personal Database

This repository contains your personal DiffChat data stored using DiffDB (GitHub-as-Database).

## Structure

${directories.map((dir) => `- \`${dir}/\` - ${dir.replace("_", " ").charAt(0).toUpperCase()}${dir.replace("_", " ").slice(1)} data`).join("\n")}

## Security

This repository is private and only accessible by you. Your chat data, preferences, and configurations are stored securely.

## DiffDB

DiffDB allows DiffChat to use GitHub repositories as a database backend, giving you:
- Full control over your data
- Version history of all changes  
- Backup and sync across devices
- No vendor lock-in

---

*Generated by DiffChat DiffDB - ${new Date().toISOString()}*
`;

      await this.writeFile(
        repoName,
        "README.md",
        readmeContent,
        "Initialize repository README",
      );
    } catch (error) {
      throw new Error(`Failed to initialize DiffDB structure: ${error}`);
    }
  }

  /**
   * Test API access and permissions
   */
  async testAccess(): Promise<{
    success: boolean;
    user?: string;
    permissions: {
      user_access: boolean;
      repo_access: boolean;
      can_create_repos: boolean;
    };
    error?: string;
  }> {
    try {
      const user = await this.getAuthenticatedUser();

      // Test repository access by listing repositories
      await this.octokit.repos.listForAuthenticatedUser({
        per_page: 1,
      });

      return {
        success: true,
        user: user.login,
        permissions: {
          user_access: true,
          repo_access: true,
          can_create_repos: true,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        permissions: {
          user_access: false,
          repo_access: false,
          can_create_repos: false,
        },
      };
    }
  }

  /**
   * Get username (initialize if needed)
   */
  async getUsername(): Promise<string> {
    if (!this.username) {
      await this.initialize();
    }
    return this.username!;
  }
}
