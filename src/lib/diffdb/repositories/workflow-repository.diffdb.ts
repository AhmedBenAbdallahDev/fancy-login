/**
 * DiffDB Workflow Repository
 *
 * GitHub-based implementation of workflow repository.
 * Workflows are complex entities with nodes, edges, and execution capabilities.
 */

import { DiffDBClient } from "../client";

export interface Workflow {
  id: string;
  userId: string;
  name: string;
  description?: string;
  nodes: any[];
  edges: any[];
  isPublic: boolean;
  tags: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export function createDiffDBWorkflowRepository(
  client: DiffDBClient,
  repositoryName: string,
) {
  const WORKFLOWS_PATH = "workflows";
  const WORKFLOW_STRUCTURES_PATH = "workflow_structures";

  return {
    async selectAll(userId: string): Promise<Workflow[]> {
      try {
        const files = await client.listDirectory(
          repositoryName,
          WORKFLOWS_PATH,
        );
        const workflows: Workflow[] = [];

        for (const file of files) {
          if (file.type === "file" && file.name.endsWith(".json")) {
            try {
              const fileInfo = await client.readFile(repositoryName, file.path);
              if (fileInfo) {
                const workflow = JSON.parse(fileInfo.content);
                if (workflow.userId === userId) {
                  workflows.push(workflow);
                }
              }
            } catch (error) {
              console.error(
                `Failed to read workflow file ${file.path}:`,
                error,
              );
            }
          }
        }

        return workflows.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      } catch (error) {
        console.error(`Failed to get workflows for user ${userId}:`, error);
        return [];
      }
    },

    async selectById(id: string): Promise<Workflow | null> {
      try {
        const filePath = `${WORKFLOWS_PATH}/${id}.json`;
        const fileInfo = await client.readFile(repositoryName, filePath);
        return fileInfo ? JSON.parse(fileInfo.content) : null;
      } catch (error) {
        console.error(`Failed to get workflow ${id}:`, error);
        return null;
      }
    },

    async selectStructureById(id: string, _options?: any): Promise<any> {
      try {
        const filePath = `${WORKFLOW_STRUCTURES_PATH}/${id}.json`;
        const fileInfo = await client.readFile(repositoryName, filePath);
        return fileInfo ? JSON.parse(fileInfo.content) : null;
      } catch (error) {
        console.error(`Failed to get workflow structure ${id}:`, error);
        return null;
      }
    },

    async selectExecuteAbility(userId: string): Promise<Workflow[]> {
      try {
        // Get workflows that the user can execute (owned or public)
        const files = await client.listDirectory(
          repositoryName,
          WORKFLOWS_PATH,
        );
        const executableWorkflows: Workflow[] = [];

        for (const file of files) {
          if (file.type === "file" && file.name.endsWith(".json")) {
            try {
              const fileInfo = await client.readFile(repositoryName, file.path);
              if (fileInfo) {
                const workflow = JSON.parse(fileInfo.content);
                if (workflow.userId === userId || workflow.isPublic) {
                  executableWorkflows.push(workflow);
                }
              }
            } catch (error) {
              console.error(
                `Failed to read workflow file ${file.path}:`,
                error,
              );
            }
          }
        }

        return executableWorkflows;
      } catch (error) {
        console.error(
          `Failed to get executable workflows for user ${userId}:`,
          error,
        );
        return [];
      }
    },

    async selectToolByIds(_toolIds: string[]): Promise<any[]> {
      // This would need to be implemented based on how tools are stored
      // For now, return empty array
      console.warn("selectToolByIds not yet implemented for DiffDB");
      return [];
    },

    async checkAccess(id: string, userId: string): Promise<boolean> {
      try {
        const workflow = await this.selectById(id);
        if (!workflow) return false;

        return workflow.userId === userId || workflow.isPublic;
      } catch (error) {
        console.error(`Failed to check access for workflow ${id}:`, error);
        return false;
      }
    },

    async save(
      workflow: Omit<Workflow, "id" | "createdAt" | "updatedAt"> | Workflow,
    ): Promise<Workflow> {
      const isUpdate = "id" in workflow && workflow.id;
      const id = isUpdate
        ? workflow.id
        : `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();

      let savedWorkflow: Workflow;

      if (isUpdate) {
        const existing = await this.selectById(workflow.id);
        if (!existing) {
          throw new Error(`Workflow with ID ${workflow.id} not found`);
        }

        savedWorkflow = {
          ...existing,
          ...workflow,
          id: existing.id,
          createdAt: existing.createdAt,
          version: existing.version + 1,
          updatedAt: now,
        };
      } else {
        savedWorkflow = {
          id,
          ...workflow,
          version: 1,
          createdAt: now,
          updatedAt: now,
        };
      }

      const filePath = `${WORKFLOWS_PATH}/${id}.json`;
      await client.writeFile(
        repositoryName,
        filePath,
        JSON.stringify(savedWorkflow, null, 2),
        `${isUpdate ? "Update" : "Create"} workflow: ${savedWorkflow.name}`,
      );

      return savedWorkflow;
    },

    async saveStructure(workflowStructure: any): Promise<any> {
      const id = workflowStructure.id;
      const filePath = `${WORKFLOW_STRUCTURES_PATH}/${id}.json`;

      await client.writeFile(
        repositoryName,
        filePath,
        JSON.stringify(workflowStructure, null, 2),
        `Update workflow structure: ${id}`,
      );

      return workflowStructure;
    },

    async delete(id: string): Promise<void> {
      try {
        // Delete workflow file
        const workflowPath = `${WORKFLOWS_PATH}/${id}.json`;
        await client.deleteFile(
          repositoryName,
          workflowPath,
          `Delete workflow: ${id}`,
        );

        // Delete structure file if it exists
        const structurePath = `${WORKFLOW_STRUCTURES_PATH}/${id}.json`;
        try {
          await client.deleteFile(
            repositoryName,
            structurePath,
            `Delete workflow structure: ${id}`,
          );
        } catch (_error) {
          // Structure file may not exist, which is fine
        }
      } catch (error) {
        console.error(`Failed to delete workflow ${id}:`, error);
        throw error;
      }
    },

    async findAll(): Promise<Workflow[]> {
      try {
        const files = await client.listDirectory(
          repositoryName,
          WORKFLOWS_PATH,
        );
        const workflows: Workflow[] = [];

        for (const file of files) {
          if (file.type === "file" && file.name.endsWith(".json")) {
            try {
              const fileInfo = await client.readFile(repositoryName, file.path);
              if (fileInfo) {
                workflows.push(JSON.parse(fileInfo.content));
              }
            } catch (error) {
              console.error(
                `Failed to read workflow file ${file.path}:`,
                error,
              );
            }
          }
        }

        return workflows;
      } catch (error) {
        console.error("Failed to get all workflows:", error);
        return [];
      }
    },
  };
}
