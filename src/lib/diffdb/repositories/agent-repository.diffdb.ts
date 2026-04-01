/**
 * DiffDB Agent Repository
 *
 * GitHub-based implementation of agent repository for AI agents/personas.
 */

import { DiffDBClient } from "../client";

export interface Agent {
  id: string;
  userId: string;
  name: string;
  description?: string;
  systemPrompt: string;
  role?: string;
  mentions?: Array<{
    type: string;
    value: string;
    [key: string]: any;
  }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  isPublic: boolean;
  tags: string[];
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export function createDiffDBAgentRepository(
  client: DiffDBClient,
  repositoryName: string,
) {
  const AGENTS_PATH = "agents";

  return {
    async selectAgentById(id: string, userId: string): Promise<Agent | null> {
      try {
        const filePath = `${AGENTS_PATH}/${id}.json`;
        const fileInfo = await client.readFile(repositoryName, filePath);
        if (!fileInfo) return null;

        const agent = JSON.parse(fileInfo.content);
        // Check access: user owns it or it's public
        if (agent.userId === userId || agent.isPublic) {
          // Transform DiffDB format back to frontend format
          return this.transformToFrontend(agent);
        }

        return null;
      } catch (error) {
        console.error(`Failed to get agent ${id}:`, error);
        return null;
      }
    },

    // Helper to transform DiffDB format to frontend format
    transformToFrontend(agent: any): any {
      const transformed = { ...agent };

      // Create nested instructions object if we have the flat fields
      if (agent.systemPrompt || agent.role || agent.mentions) {
        transformed.instructions = {
          systemPrompt: agent.systemPrompt,
          role: agent.role,
          mentions: agent.mentions,
        };
        delete transformed.systemPrompt;
        delete transformed.role;
        delete transformed.mentions;
      }

      // Create nested icon object if we have avatar
      if (agent.avatar) {
        transformed.icon = {
          type: "emoji" as const,
          value: agent.avatar,
        };
        delete transformed.avatar;
      }

      return transformed;
    },

    async selectAgentsByUserId(userId: string): Promise<Agent[]> {
      try {
        const files = await client.listDirectory(repositoryName, AGENTS_PATH);
        const agents: Agent[] = [];

        for (const file of files) {
          if (file.type === "file" && file.name.endsWith(".json")) {
            try {
              const fileInfo = await client.readFile(repositoryName, file.path);
              if (fileInfo) {
                const agent = JSON.parse(fileInfo.content);
                if (agent.userId === userId) {
                  agents.push(this.transformToFrontend(agent));
                }
              }
            } catch (error) {
              console.error(`Failed to read agent file ${file.path}:`, error);
            }
          }
        }

        return agents.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      } catch (error) {
        console.error(`Failed to get agents for user ${userId}:`, error);
        return [];
      }
    },

    async selectPublicAgents(): Promise<Agent[]> {
      try {
        const files = await client.listDirectory(repositoryName, AGENTS_PATH);
        const publicAgents: Agent[] = [];

        for (const file of files) {
          if (file.type === "file" && file.name.endsWith(".json")) {
            try {
              const fileInfo = await client.readFile(repositoryName, file.path);
              if (fileInfo) {
                const agent = JSON.parse(fileInfo.content);
                if (agent.isPublic) {
                  publicAgents.push(this.transformToFrontend(agent));
                }
              }
            } catch (error) {
              console.error(`Failed to read agent file ${file.path}:`, error);
            }
          }
        }

        return publicAgents.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      } catch (error) {
        console.error("Failed to get public agents:", error);
        return [];
      }
    },

    async selectPublicAgentById(id: string): Promise<Agent | null> {
      try {
        const agent = await this.selectAgentById(id, ""); // Empty userId since we only want public
        // Already transformed by selectAgentById
        return agent && agent.isPublic ? agent : null;
      } catch (error) {
        console.error(`Failed to get public agent ${id}:`, error);
        return null;
      }
    },

    async upsertAgent(
      agent: Omit<Agent, "id" | "createdAt" | "updatedAt"> | Agent,
    ): Promise<Agent> {
      const isUpdate = "id" in agent && agent.id;
      const id = isUpdate
        ? agent.id
        : `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();

      // Transform frontend format to DiffDB format
      const transformedAgent: any = { ...agent };

      // Handle nested instructions -> flat structure
      if ((agent as any).instructions) {
        const instructions = (agent as any).instructions;

        // Extract systemPrompt
        if (instructions.systemPrompt && !agent.systemPrompt) {
          transformedAgent.systemPrompt = instructions.systemPrompt;
        }

        // Extract role
        if (instructions.role && !transformedAgent.role) {
          transformedAgent.role = instructions.role;
        }

        // Extract mentions (MCP tools access)
        if (instructions.mentions && !transformedAgent.mentions) {
          transformedAgent.mentions = instructions.mentions;
        }

        // Remove nested instructions object
        delete transformedAgent.instructions;
      }

      // Handle icon.value -> avatar
      if ((agent as any).icon?.value && !agent.avatar) {
        transformedAgent.avatar = (agent as any).icon.value;
        delete transformedAgent.icon;
      }

      let savedAgent: Agent;

      if (isUpdate) {
        const existing = await this.selectAgentById(
          transformedAgent.id,
          transformedAgent.userId,
        );
        if (!existing) {
          throw new Error(`Agent with ID ${transformedAgent.id} not found`);
        }

        savedAgent = {
          ...existing,
          ...transformedAgent,
          id: existing.id,
          createdAt: existing.createdAt,
          updatedAt: now,
        };
      } else {
        savedAgent = {
          id,
          ...transformedAgent,
          createdAt: now,
          updatedAt: now,
        };
      }

      const filePath = `${AGENTS_PATH}/${id}.json`;
      await client.writeFile(
        repositoryName,
        filePath,
        JSON.stringify(savedAgent, null, 2),
        `${isUpdate ? "Update" : "Create"} agent: ${savedAgent.name}`,
      );

      return savedAgent;
    },

    async insertAgent(
      agent: Omit<Agent, "id" | "createdAt" | "updatedAt">,
    ): Promise<Agent> {
      return this.upsertAgent(agent);
    },

    async updateAgent(
      id: string,
      userId: string,
      update: Partial<Agent>,
    ): Promise<Agent | null> {
      try {
        const existing = await this.selectAgentById(id, userId);
        if (!existing || existing.userId !== userId) {
          return null; // Can only update own agents
        }

        return await this.upsertAgent({
          ...existing,
          ...update,
          id: existing.id,
          userId: existing.userId, // Prevent user change
        });
      } catch (error) {
        console.error(`Failed to update agent ${id}:`, error);
        return null;
      }
    },

    async deleteAgent(id: string, userId: string): Promise<void> {
      try {
        const existing = await this.selectAgentById(id, userId);
        if (!existing || existing.userId !== userId) {
          throw new Error("Agent not found or access denied");
        }

        const filePath = `${AGENTS_PATH}/${id}.json`;
        await client.deleteFile(
          repositoryName,
          filePath,
          `Delete agent: ${existing.name}`,
        );
      } catch (error) {
        console.error(`Failed to delete agent ${id}:`, error);
        throw error;
      }
    },

    async findAll(): Promise<Agent[]> {
      try {
        const files = await client.listDirectory(repositoryName, AGENTS_PATH);
        const agents: Agent[] = [];

        for (const file of files) {
          if (file.type === "file" && file.name.endsWith(".json")) {
            try {
              const fileInfo = await client.readFile(repositoryName, file.path);
              if (fileInfo) {
                agents.push(
                  this.transformToFrontend(JSON.parse(fileInfo.content)),
                );
              }
            } catch (error) {
              console.error(`Failed to read agent file ${file.path}:`, error);
            }
          }
        }

        return agents;
      } catch (error) {
        console.error("Failed to get all agents:", error);
        return [];
      }
    },
  };
}
