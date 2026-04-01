import { DiffDBClient } from "../client";
import {
  StylePreset,
  StylePresetCreate,
  StylePresetUpdate,
  StylePresetRepository,
} from "app-types/style-preset";

const STYLE_PRESET_FILE = "style-presets.json";

export function createDiffDBStylePresetRepository(
  diffdbClient: DiffDBClient,
  repoName: string,
): StylePresetRepository {
  const readPresets = async (): Promise<StylePreset[]> => {
    try {
      const fileInfo = await diffdbClient.readFile(repoName, STYLE_PRESET_FILE);
      if (!fileInfo) return [];
      const content = Buffer.from(fileInfo.content, "base64").toString("utf-8");
      return JSON.parse(content) as StylePreset[];
    } catch (error: any) {
      if (error.status === 404) {
        return [];
      }
      throw error;
    }
  };

  const writePresets = async (presets: StylePreset[]): Promise<void> => {
    await diffdbClient.writeFile(
      repoName,
      STYLE_PRESET_FILE,
      JSON.stringify(presets, null, 2),
    );
  };

  return {
    async create(
      userId: string,
      data: StylePresetCreate,
    ): Promise<StylePreset> {
      const presets = await readPresets();

      // If setting as default, unset other defaults
      if (data.isDefault) {
        presets.forEach((p) => {
          if (p.userId === userId) p.isDefault = false;
        });
      }

      const newPreset: StylePreset = {
        id: crypto.randomUUID(),
        userId,
        name: data.name,
        description: data.description,
        systemPrompt: data.systemPrompt,
        isDefault: data.isDefault ?? false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      presets.push(newPreset);
      await writePresets(presets);

      return newPreset;
    },

    async findById(id: string, userId: string): Promise<StylePreset | null> {
      const presets = await readPresets();
      return presets.find((p) => p.id === id && p.userId === userId) ?? null;
    },

    async findByUserId(userId: string): Promise<StylePreset[]> {
      const presets = await readPresets();
      return presets
        .filter((p) => p.userId === userId)
        .sort((a, b) => {
          if (a.isDefault && !b.isDefault) return -1;
          if (!a.isDefault && b.isDefault) return 1;
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        });
    },

    async findDefault(userId: string): Promise<StylePreset | null> {
      const presets = await readPresets();
      return presets.find((p) => p.userId === userId && p.isDefault) ?? null;
    },

    async update(
      id: string,
      userId: string,
      data: StylePresetUpdate,
    ): Promise<StylePreset> {
      const presets = await readPresets();
      const index = presets.findIndex(
        (p) => p.id === id && p.userId === userId,
      );

      if (index === -1) {
        throw new Error("Style preset not found");
      }

      // If setting as default, unset other defaults
      if (data.isDefault) {
        presets.forEach((p) => {
          if (p.userId === userId) p.isDefault = false;
        });
      }

      presets[index] = {
        ...presets[index],
        ...data,
        updatedAt: new Date(),
      };

      await writePresets(presets);
      return presets[index];
    },

    async setDefault(id: string, userId: string): Promise<void> {
      const presets = await readPresets();

      // Unset all defaults for this user
      presets.forEach((p) => {
        if (p.userId === userId) p.isDefault = false;
      });

      // Set the new default
      const preset = presets.find((p) => p.id === id && p.userId === userId);
      if (preset) {
        preset.isDefault = true;
        preset.updatedAt = new Date();
      }

      await writePresets(presets);
    },

    async delete(id: string, userId: string): Promise<void> {
      const presets = await readPresets();
      const filtered = presets.filter(
        (p) => !(p.id === id && p.userId === userId),
      );
      await writePresets(filtered);
    },
  };
}
