/**
 * DiffDB MCP Tool Customization Repository
 *
 * Stores MCP tool-level prompt customizations in GitHub using DiffDB.
 */

import type {
  McpToolCustomization,
  McpToolCustomizationRepository,
} from "app-types/mcp";
import { DiffDBClient } from "../client";

const BASE_PATH = "mcp_tool_customizations";

function buildUserDir(userId: string) {
  return `${BASE_PATH}/user-${userId}`;
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9-_]/g, "_");
}

function buildServerDir(userId: string, mcpServerId: string) {
  return `${buildUserDir(userId)}/server-${mcpServerId}`;
}

function buildFilePath(userId: string, mcpServerId: string, toolName: string) {
  return `${buildServerDir(userId, mcpServerId)}/tool-${safeSegment(toolName)}.json`;
}

async function fetchServerName(
  client: DiffDBClient,
  repositoryName: string,
  mcpServerId: string,
): Promise<string | undefined> {
  try {
    const path = `mcp_servers/${mcpServerId}.json`;
    const file = await client.readFile(repositoryName, path);
    if (!file) return undefined;
    const data = JSON.parse(file.content);
    return data?.name ?? undefined;
  } catch (error) {
    console.warn(
      `DiffDB: Failed to fetch MCP server ${mcpServerId} name for tool customization:`,
      error,
    );
    return undefined;
  }
}

export function createDiffDBMcpToolCustomizationRepository(
  client: DiffDBClient,
  repositoryName: string,
): McpToolCustomizationRepository {
  type StoredToolCustomization = McpToolCustomization & {
    serverName?: string;
    createdAt?: string;
    updatedAt?: string;
  };

  async function readCustomization(
    userId: string,
    mcpServerId: string,
    toolName: string,
  ): Promise<(StoredToolCustomization & { serverName: string }) | null> {
    try {
      const filePath = buildFilePath(userId, mcpServerId, toolName);
      const fileInfo = await client.readFile(repositoryName, filePath);
      if (!fileInfo) return null;

      const data = JSON.parse(fileInfo.content) as StoredToolCustomization;
      let serverName = data.serverName;
      if (!serverName) {
        serverName =
          (await fetchServerName(client, repositoryName, mcpServerId)) ?? "";
      }

      return {
        ...data,
        serverName,
      };
    } catch (error) {
      console.error("DiffDB: Failed to read MCP tool customization:", error);
      return null;
    }
  }

  return {
    async select({ userId, mcpServerId, toolName }) {
      return readCustomization(userId, mcpServerId, toolName);
    },

    async selectByUserIdAndMcpServerId({ userId, mcpServerId }) {
      try {
        const serverDir = buildServerDir(userId, mcpServerId);
        const files = await client.listDirectory(repositoryName, serverDir);
        const results: (McpToolCustomization & { serverName: string })[] = [];

        for (const file of files) {
          if (file.type !== "file" || !file.name.endsWith(".json")) continue;
          const toolSegment = file.name
            .replace(/^tool-/, "")
            .replace(/\.json$/, "");
          const customization = await readCustomization(
            userId,
            mcpServerId,
            toolSegment,
          );
          if (customization) {
            results.push(customization);
          }
        }

        return results;
      } catch (error) {
        if ((error as any)?.status === 404) {
          return [];
        }
        console.error("DiffDB: Failed to list MCP tool customizations:", error);
        return [];
      }
    },

    async selectByUserId(userId) {
      try {
        const userDir = buildUserDir(userId);
        const entries = await client.listDirectory(repositoryName, userDir);
        const results: (McpToolCustomization & { serverName: string })[] = [];

        for (const entry of entries) {
          if (entry.type !== "dir") continue;
          const serverId = entry.name.replace(/^server-/, "");
          const serverDir = buildServerDir(userId, serverId);

          try {
            const files = await client.listDirectory(repositoryName, serverDir);
            for (const file of files) {
              if (file.type !== "file" || !file.name.endsWith(".json")) {
                continue;
              }
              const toolSegment = file.name
                .replace(/^tool-/, "")
                .replace(/\.json$/, "");
              const customization = await readCustomization(
                userId,
                serverId,
                toolSegment,
              );
              if (customization) {
                results.push(customization);
              }
            }
          } catch (innerError: any) {
            if (innerError?.status !== 404) {
              console.error(
                "DiffDB: Failed to list MCP tool customizations for server",
                { userId, serverId, innerError },
              );
            }
          }
        }

        return results;
      } catch (error) {
        if ((error as any)?.status === 404) {
          return [];
        }
        console.error(
          "DiffDB: Failed to list user MCP tool customizations:",
          error,
        );
        return [];
      }
    },

    async upsertToolCustomization(data) {
      const { userId, mcpServerId, toolName } = data;
      const existing = await readCustomization(userId, mcpServerId, toolName);
      const now = new Date().toISOString();
      const serverName =
        existing?.serverName ||
        (await fetchServerName(client, repositoryName, mcpServerId)) ||
        "";

      const record: StoredToolCustomization & { serverName: string } = {
        id: existing?.id ?? `${userId}-${mcpServerId}-${toolName}`,
        userId,
        mcpServerId,
        toolName,
        prompt: data.prompt ?? null,
        serverName,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      const filePath = buildFilePath(userId, mcpServerId, toolName);
      await client.writeFile(
        repositoryName,
        filePath,
        JSON.stringify(record, null, 2),
        `${existing ? "Update" : "Create"} MCP tool customization: ${toolName}`,
      );

      return record;
    },

    async deleteToolCustomization({ userId, mcpServerId, toolName }) {
      const filePath = buildFilePath(userId, mcpServerId, toolName);
      try {
        await client.deleteFile(
          repositoryName,
          filePath,
          `Delete MCP tool customization: ${toolName}`,
        );
      } catch (error: any) {
        if (error?.status === 404) return;
        console.error(
          "DiffDB: Failed to delete MCP tool customization:",
          error,
        );
        throw error;
      }
    },
  };
}
