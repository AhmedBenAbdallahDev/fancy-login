/**
 * DiffDB User Repository
 *
 * GitHub-based implementation of user repository.
 * Note: User data comes primarily from GitHub OAuth, but we can store
 * additional user preferences and settings in the repository.
 */

import { DiffDBClient } from "../client";

export interface UserProfile {
  id: string;
  githubId: number;
  username: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  preferences: {
    theme: string;
    language: string;
    notifications: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export function createDiffDBUserRepository(
  client: DiffDBClient,
  repositoryName: string,
) {
  const USERS_PATH = "users";

  return {
    async findById(id: string): Promise<UserProfile | null> {
      try {
        const filePath = `${USERS_PATH}/${id}.json`;
        const fileInfo = await client.readFile(repositoryName, filePath);
        return fileInfo ? JSON.parse(fileInfo.content) : null;
      } catch (error) {
        console.error(`Failed to get user ${id}:`, error);
        return null;
      }
    },

    async create(
      userData: Omit<UserProfile, "createdAt" | "updatedAt">,
    ): Promise<UserProfile> {
      const now = new Date().toISOString();

      const preferences = Object.assign(
        {
          theme: "dark",
          language: "en",
          notifications: true,
        },
        userData.preferences || {},
      ) as UserProfile["preferences"];

      const newUser: UserProfile = {
        ...userData,
        preferences,
        createdAt: now,
        updatedAt: now,
      };

      const filePath = `${USERS_PATH}/${userData.id}.json`;
      await client.writeFile(
        repositoryName,
        filePath,
        JSON.stringify(newUser, null, 2),
        `Create user profile: ${userData.username}`,
      );

      return newUser;
    },

    async update(
      id: string,
      updates: Partial<UserProfile>,
    ): Promise<UserProfile | null> {
      const existing = await this.findById(id);
      if (!existing) return null;

      const updated: UserProfile = {
        ...existing,
        ...updates,
        id: existing.id, // Prevent ID change
        createdAt: existing.createdAt, // Prevent createdAt change
        preferences: {
          ...existing.preferences,
          ...updates.preferences,
        },
        updatedAt: new Date().toISOString(),
      };

      const filePath = `${USERS_PATH}/${id}.json`;
      await client.writeFile(
        repositoryName,
        filePath,
        JSON.stringify(updated, null, 2),
        `Update user profile: ${updated.username}`,
      );

      return updated;
    },

    async delete(id: string): Promise<void> {
      try {
        const filePath = `${USERS_PATH}/${id}.json`;
        await client.deleteFile(
          repositoryName,
          filePath,
          `Delete user profile: ${id}`,
        );
      } catch (error) {
        console.error(`Failed to delete user ${id}:`, error);
        throw error;
      }
    },

    async updatePreferences(
      id: string,
      preferences: Partial<UserProfile["preferences"]>,
    ): Promise<UserProfile | null> {
      const existing = await this.findById(id);
      if (!existing) return null;

      return await this.update(id, {
        preferences: {
          ...existing.preferences,
          ...preferences,
        },
      });
    },

    // Find user by GitHub username (for lookup by OAuth data)
    async findByUsername(username: string): Promise<UserProfile | null> {
      try {
        // List all user files
        const files = await client.listDirectory(repositoryName, USERS_PATH);

        // Read each user file and find by username
        for (const file of files) {
          if (file.type === "file" && file.name.endsWith(".json")) {
            try {
              const fileInfo = await client.readFile(repositoryName, file.path);
              if (fileInfo) {
                const user = JSON.parse(fileInfo.content);
                if (user.username === username) {
                  return user;
                }
              }
            } catch (error) {
              console.error(`Failed to read user file ${file.path}:`, error);
            }
          }
        }

        return null;
      } catch (error) {
        console.error(`Failed to find user by username ${username}:`, error);
        return null;
      }
    },

    // Find user by GitHub ID (for OAuth lookup)
    async findByGitHubId(githubId: number): Promise<UserProfile | null> {
      try {
        // List all user files
        const files = await client.listDirectory(repositoryName, USERS_PATH);

        // Read each user file and find by GitHub ID
        for (const file of files) {
          if (file.type === "file" && file.name.endsWith(".json")) {
            try {
              const fileInfo = await client.readFile(repositoryName, file.path);
              if (fileInfo) {
                const user = JSON.parse(fileInfo.content);
                if (user.githubId === githubId) {
                  return user;
                }
              }
            } catch (error) {
              console.error(`Failed to read user file ${file.path}:`, error);
            }
          }
        }

        return null;
      } catch (error) {
        console.error(`Failed to find user by GitHub ID ${githubId}:`, error);
        return null;
      }
    },
  };
}
