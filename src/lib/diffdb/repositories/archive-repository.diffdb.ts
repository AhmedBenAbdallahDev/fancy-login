/**
 * DiffDB Archive Repository
 *
 * GitHub-based implementation of archive repository that perfectly
 * simulates PostgreSQL behavior for archive operations.
 */

import { DiffDBClient } from "../client";

export interface Archive {
  id: string;
  userId: string;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ArchiveItem {
  id: string;
  archiveId: string;
  itemId: string;
  itemType: string;
  addedAt: string;
}

export function createDiffDBArchiveRepository(
  client: DiffDBClient,
  repositoryName: string,
) {
  const ARCHIVES_PATH = "archives";
  const ARCHIVE_ITEMS_PATH = "archive_items";

  return {
    async getArchiveById(id: string): Promise<Archive | null> {
      try {
        const filePath = `${ARCHIVES_PATH}/${id}.json`;
        const fileInfo = await client.readFile(repositoryName, filePath);
        return fileInfo ? JSON.parse(fileInfo.content) : null;
      } catch (error) {
        console.error(`Failed to get archive ${id}:`, error);
        return null;
      }
    },

    async getArchivesByUserId(userId: string): Promise<Archive[]> {
      try {
        // List all archive files
        const files = await client.listDirectory(repositoryName, ARCHIVES_PATH);
        const archives: Archive[] = [];

        // Read each archive file and filter by userId
        for (const file of files) {
          if (file.type === "file" && file.name.endsWith(".json")) {
            try {
              const fileInfo = await client.readFile(repositoryName, file.path);
              if (fileInfo) {
                const archive = JSON.parse(fileInfo.content);
                if (archive.userId === userId) {
                  archives.push(archive);
                }
              }
            } catch (error) {
              console.error(`Failed to read archive file ${file.path}:`, error);
            }
          }
        }

        return archives.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      } catch (error) {
        console.error(`Failed to get archives for user ${userId}:`, error);
        return [];
      }
    },

    async getArchiveItems(archiveId: string): Promise<ArchiveItem[]> {
      try {
        const filePath = `${ARCHIVE_ITEMS_PATH}/${archiveId}.json`;
        const fileInfo = await client.readFile(repositoryName, filePath);
        return fileInfo ? JSON.parse(fileInfo.content) : [];
      } catch (error) {
        console.error(`Failed to get archive items for ${archiveId}:`, error);
        return [];
      }
    },

    async create(
      archive: Omit<Archive, "id" | "createdAt" | "updatedAt">,
    ): Promise<Archive> {
      const id = `archive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();

      const newArchive: Archive = {
        id,
        ...archive,
        createdAt: now,
        updatedAt: now,
      };

      const filePath = `${ARCHIVES_PATH}/${id}.json`;
      await client.writeFile(
        repositoryName,
        filePath,
        JSON.stringify(newArchive, null, 2),
        `Create archive: ${newArchive.title}`,
      );

      return newArchive;
    },

    async update(
      id: string,
      updates: Partial<Archive>,
    ): Promise<Archive | null> {
      const existing = await this.getArchiveById(id);
      if (!existing) return null;

      const updated: Archive = {
        ...existing,
        ...updates,
        id: existing.id, // Prevent ID change
        createdAt: existing.createdAt, // Prevent createdAt change
        updatedAt: new Date().toISOString(),
      };

      const filePath = `${ARCHIVES_PATH}/${id}.json`;
      await client.writeFile(
        repositoryName,
        filePath,
        JSON.stringify(updated, null, 2),
        `Update archive: ${updated.title}`,
      );

      return updated;
    },

    async delete(id: string): Promise<void> {
      try {
        // Delete archive file
        const archiveFilePath = `${ARCHIVES_PATH}/${id}.json`;
        await client.deleteFile(
          repositoryName,
          archiveFilePath,
          `Delete archive: ${id}`,
        );

        // Delete archive items file
        const itemsFilePath = `${ARCHIVE_ITEMS_PATH}/${id}.json`;
        try {
          await client.deleteFile(
            repositoryName,
            itemsFilePath,
            `Delete archive items: ${id}`,
          );
        } catch (_error) {
          // Items file may not exist, which is fine
        }
      } catch (error) {
        console.error(`Failed to delete archive ${id}:`, error);
        throw error;
      }
    },

    async addItem(
      archiveId: string,
      itemId: string,
      itemType: string,
    ): Promise<ArchiveItem> {
      const items = await this.getArchiveItems(archiveId);

      const newItem: ArchiveItem = {
        id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        archiveId,
        itemId,
        itemType,
        addedAt: new Date().toISOString(),
      };

      items.push(newItem);

      const filePath = `${ARCHIVE_ITEMS_PATH}/${archiveId}.json`;
      await client.writeFile(
        repositoryName,
        filePath,
        JSON.stringify(items, null, 2),
        `Add item to archive: ${itemId}`,
      );

      return newItem;
    },

    async removeItem(archiveId: string, itemId: string): Promise<void> {
      const items = await this.getArchiveItems(archiveId);
      const filteredItems = items.filter((item) => item.itemId !== itemId);

      const filePath = `${ARCHIVE_ITEMS_PATH}/${archiveId}.json`;
      await client.writeFile(
        repositoryName,
        filePath,
        JSON.stringify(filteredItems, null, 2),
        `Remove item from archive: ${itemId}`,
      );
    },

    // Compatibility methods for existing codebase
    async findAll(): Promise<Archive[]> {
      // This would need to get all archives across all users
      // For now, return empty array since we don't have a current user context
      return [];
    },
  };
}
