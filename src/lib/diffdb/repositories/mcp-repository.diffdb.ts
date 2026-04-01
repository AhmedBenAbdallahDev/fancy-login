/**
 * DiffDB MCP Repository
 *
 * GitHub-based implementation of MCP server repository for storing
 * Model Context Protocol server configurations.
 */

import { DiffDBClient } from "../client";

export interface MCPServer {
  id: string;
  userId: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
  enabled: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export function createDiffDBMcpRepository(
  client: DiffDBClient,
  repositoryName: string,
) {
  const MCP_SERVERS_PATH = "mcp_servers";

  return {
    async selectAll(): Promise<MCPServer[]> {
      try {
        // List all MCP server files
        const files = await client.listDirectory(
          repositoryName,
          MCP_SERVERS_PATH,
        );
        const servers: MCPServer[] = [];

        // Read each server file
        for (const file of files) {
          if (file.type === "file" && file.name.endsWith(".json")) {
            try {
              const fileInfo = await client.readFile(repositoryName, file.path);
              if (fileInfo) {
                const server = JSON.parse(fileInfo.content);
                servers.push(server);
              }
            } catch (error) {
              console.error(
                `Failed to read MCP server file ${file.path}:`,
                error,
              );
            }
          }
        }

        return servers.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      } catch (error) {
        console.error("Failed to get all MCP servers:", error);
        return [];
      }
    },

    async selectById(id: string): Promise<MCPServer | null> {
      try {
        const filePath = `${MCP_SERVERS_PATH}/${id}.json`;
        const fileInfo = await client.readFile(repositoryName, filePath);
        return fileInfo ? JSON.parse(fileInfo.content) : null;
      } catch (error) {
        console.error(`Failed to get MCP server ${id}:`, error);
        return null;
      }
    },

    async save(
      server: Omit<MCPServer, "id" | "createdAt" | "updatedAt"> | MCPServer,
    ): Promise<MCPServer> {
      const isUpdate = "id" in server && server.id;
      const id = isUpdate
        ? server.id
        : `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();

      let savedServer: MCPServer;

      if (isUpdate) {
        // Update existing server
        const existing = await this.selectById(server.id);
        if (!existing) {
          throw new Error(`MCP server with ID ${server.id} not found`);
        }

        savedServer = {
          ...existing,
          ...server,
          id: existing.id, // Prevent ID change
          createdAt: existing.createdAt, // Prevent createdAt change
          updatedAt: now,
        };
      } else {
        // Create new server
        savedServer = {
          id,
          ...server,
          createdAt: now,
          updatedAt: now,
        };
      }

      const filePath = `${MCP_SERVERS_PATH}/${id}.json`;
      await client.writeFile(
        repositoryName,
        filePath,
        JSON.stringify(savedServer, null, 2),
        `${isUpdate ? "Update" : "Create"} MCP server: ${savedServer.name}`,
      );

      return savedServer;
    },

    async deleteById(id: string): Promise<void> {
      try {
        const filePath = `${MCP_SERVERS_PATH}/${id}.json`;
        await client.deleteFile(
          repositoryName,
          filePath,
          `Delete MCP server: ${id}`,
        );
      } catch (error) {
        console.error(`Failed to delete MCP server ${id}:`, error);
        throw error;
      }
    },

    async findByUserId(userId: string): Promise<MCPServer[]> {
      try {
        const allServers = await this.selectAll();
        return allServers.filter((server) => server.userId === userId);
      } catch (error) {
        console.error(`Failed to get MCP servers for user ${userId}:`, error);
        return [];
      }
    },

    async findByName(name: string): Promise<MCPServer | null> {
      try {
        const allServers = await this.selectAll();
        return allServers.find((server) => server.name === name) || null;
      } catch (error) {
        console.error(`Failed to find MCP server by name ${name}:`, error);
        return null;
      }
    },

    async toggleEnabled(
      id: string,
      enabled: boolean,
    ): Promise<MCPServer | null> {
      try {
        const existing = await this.selectById(id);
        if (!existing) return null;

        return await this.save({
          ...existing,
          enabled,
        });
      } catch (error) {
        console.error(`Failed to toggle MCP server ${id}:`, error);
        return null;
      }
    },

    // Compatibility methods for existing codebase
    async findAll(): Promise<MCPServer[]> {
      return this.selectAll();
    },
  };
}
