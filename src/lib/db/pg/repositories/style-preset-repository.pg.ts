import { eq, and, desc } from "drizzle-orm";
import { pgDb as db } from "../db.pg";
import { StylePresetSchema } from "../schema.pg";
import {
  StylePreset,
  StylePresetCreate,
  StylePresetUpdate,
  StylePresetRepository,
} from "app-types/style-preset";
import { generateUUID } from "lib/utils";

export const pgStylePresetRepository: StylePresetRepository = {
  async create(userId: string, data: StylePresetCreate): Promise<StylePreset> {
    // If this is being set as default, unset other defaults first
    if (data.isDefault) {
      await db
        .update(StylePresetSchema)
        .set({ isDefault: false })
        .where(eq(StylePresetSchema.userId, userId));
    }

    const [result] = await db
      .insert(StylePresetSchema)
      .values({
        id: generateUUID(),
        userId,
        name: data.name,
        description: data.description,
        systemPrompt: data.systemPrompt,
        isDefault: data.isDefault ?? false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return result as StylePreset;
  },

  async findById(id: string, userId: string): Promise<StylePreset | null> {
    const [result] = await db
      .select()
      .from(StylePresetSchema)
      .where(
        and(eq(StylePresetSchema.id, id), eq(StylePresetSchema.userId, userId)),
      );

    if (!result) return null;

    return {
      ...result,
      description: result.description ?? undefined,
    } as StylePreset;
  },

  async findByUserId(userId: string): Promise<StylePreset[]> {
    const results = await db
      .select()
      .from(StylePresetSchema)
      .where(eq(StylePresetSchema.userId, userId))
      .orderBy(
        desc(StylePresetSchema.isDefault),
        desc(StylePresetSchema.updatedAt),
      );

    return results.map((r) => ({
      ...r,
      description: r.description ?? undefined,
    })) as StylePreset[];
  },

  async findDefault(userId: string): Promise<StylePreset | null> {
    const [result] = await db
      .select()
      .from(StylePresetSchema)
      .where(
        and(
          eq(StylePresetSchema.userId, userId),
          eq(StylePresetSchema.isDefault, true),
        ),
      );

    if (!result) return null;

    return {
      ...result,
      description: result.description ?? undefined,
    } as StylePreset;
  },

  async update(
    id: string,
    userId: string,
    data: StylePresetUpdate,
  ): Promise<StylePreset> {
    // If setting as default, unset other defaults first
    if (data.isDefault) {
      await db
        .update(StylePresetSchema)
        .set({ isDefault: false })
        .where(eq(StylePresetSchema.userId, userId));
    }

    const [result] = await db
      .update(StylePresetSchema)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(eq(StylePresetSchema.id, id), eq(StylePresetSchema.userId, userId)),
      )
      .returning();

    return result as StylePreset;
  },

  async setDefault(id: string, userId: string): Promise<void> {
    // Unset all defaults for this user
    await db
      .update(StylePresetSchema)
      .set({ isDefault: false })
      .where(eq(StylePresetSchema.userId, userId));

    // Set the new default
    await db
      .update(StylePresetSchema)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(
        and(eq(StylePresetSchema.id, id), eq(StylePresetSchema.userId, userId)),
      );
  },

  async delete(id: string, userId: string): Promise<void> {
    await db
      .delete(StylePresetSchema)
      .where(
        and(eq(StylePresetSchema.id, id), eq(StylePresetSchema.userId, userId)),
      );
  },
};
