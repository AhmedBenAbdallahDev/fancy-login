/**
 * DiffDB MCP Server Customization Repository
 *
 * Stores MCP server-level prompt customizations in GitHub
 * using the DiffDB client. Data is stored per user / per server
 * to mimic the PostgreSQL schema.
 */

import type {
  McpServerCustomization,
  McpServerCustomizationRepository,
} from "app-types/mcp";
import { DiffDBClient } from "../client";

const BASE_PATH = "mcp_server_customizations";

function buildUserDir(userId: string) {
  return `${BASE_PATH}/user-${userId}`;
}

function buildFilePath(userId: string, mcpServerId: string) {
  return `${buildUserDir(userId)}/server-${mcpServerId}.json`;
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
      `DiffDB: Failed to fetch MCP server ${mcpServerId} name for customization:`,
      error,
    );
    return undefined;
  }
}

export function createDiffDBMcpServerCustomizationRepository(
  client: DiffDBClient,
  repositoryName: string,
): McpServerCustomizationRepository {
  type StoredServerCustomization = McpServerCustomization & {
    serverName?: string;
    createdAt?: string;
    updatedAt?: string;
  };

  async function readCustomization(
    userId: string,
    mcpServerId: string,
  ): Promise<(StoredServerCustomization & { serverName: string }) | null> {
    try {
      const filePath = buildFilePath(userId, mcpServerId);
      const fileInfo = await client.readFile(repositoryName, filePath);
      if (!fileInfo) return null;

      const data = JSON.parse(fileInfo.content) as StoredServerCustomization;
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
      console.error("DiffDB: Failed to read MCP server customization:", error);
      return null;
    }
  }

  return {
    async selectByUserIdAndMcpServerId({ userId, mcpServerId }) {
      return readCustomization(userId, mcpServerId);
    },

    async selectByUserId(userId) {
      try {
        const userDir = buildUserDir(userId);
        const files = await client.listDirectory(repositoryName, userDir);
        const results: (McpServerCustomization & { serverName: string })[] = [];

        for (const file of files) {
          if (file.type !== "file" || !file.name.endsWith(".json")) continue;
          const serverId = file.name
            .replace(/^server-/, "")
            .replace(/\.json$/, "");
          const customization = await readCustomization(userId, serverId);
          if (customization) {
            results.push(customization);
          }
        }

        return results;
      } catch (error) {
        if ((error as any)?.status === 404) {
          return [];
        }
        console.error(
          "DiffDB: Failed to list MCP server customizations:",
          error,
        );
        return [];
      }
    },

    async upsertMcpServerCustomization(data) {
      const { userId, mcpServerId } = data;
      const existing = await readCustomization(userId, mcpServerId);
      const now = new Date().toISOString();
      const serverName =
        existing?.serverName ||
        (await fetchServerName(client, repositoryName, mcpServerId)) ||
        "";

      const record: StoredServerCustomization & { serverName: string } = {
        id: existing?.id ?? `${userId}-${mcpServerId}`,
        userId,
        mcpServerId,
        prompt: data.prompt ?? null,
        serverName,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      const filePath = buildFilePath(userId, mcpServerId);
      await client.writeFile(
        repositoryName,
        filePath,
        JSON.stringify(record, null, 2),
        `${existing ? "Update" : "Create"} MCP server customization: ${mcpServerId}`,
      );

      return record;
    },

    async deleteMcpServerCustomizationByMcpServerIdAndUserId({
      mcpServerId,
      userId,
    }) {
      const filePath = buildFilePath(userId, mcpServerId);
      try {
        await client.deleteFile(
          repositoryName,
          filePath,
          `Delete MCP server customization: ${mcpServerId}`,
        );
      } catch (error: any) {
        if (error?.status === 404) return;
        console.error(
          "DiffDB: Failed to delete MCP server customization:",
          error,
        );
        throw error;
      }
    },
  };
}
