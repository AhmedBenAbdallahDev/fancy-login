/**
 * Character Lorebook Repository - PostgreSQL Implementation
 */

import { pgDb } from "../db.pg";
import { CharacterLorebookSchema } from "../schema.pg";
import { eq, and } from "drizzle-orm";
import type { LorebookEntry } from "app-types/external-character";

export interface CharacterLorebook {
  id: string;
  characterId: string;
  name: string;
  entries: LorebookEntry[];
  isEmbedded: boolean;
  sourceLorebookId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LorebookCreate {
  name: string;
  entries: LorebookEntry[];
  isEmbedded?: boolean;
  sourceLorebookId?: string;
}

export interface LorebookRepository {
  create(characterId: string, data: LorebookCreate): Promise<CharacterLorebook>;
  findByCharacterId(characterId: string): Promise<CharacterLorebook | null>;
  findAllByCharacterId(characterId: string): Promise<CharacterLorebook[]>;
  update(
    id: string,
    characterId: string,
    data: Partial<LorebookCreate>,
  ): Promise<CharacterLorebook>;
  delete(id: string, characterId: string): Promise<void>;
  deleteAllForCharacter(characterId: string): Promise<void>;
}

export const pgLorebookRepository: LorebookRepository = {
  async create(
    characterId: string,
    data: LorebookCreate,
  ): Promise<CharacterLorebook> {
    const [lorebook] = await pgDb
      .insert(CharacterLorebookSchema)
      .values({
        characterId,
        name: data.name,
        entries: data.entries,
        isEmbedded: data.isEmbedded ?? false,
        sourceLorebookId: data.sourceLorebookId,
      })
      .returning();

    return {
      id: lorebook.id,
      characterId: lorebook.characterId,
      name: lorebook.name,
      entries: lorebook.entries,
      isEmbedded: lorebook.isEmbedded,
      sourceLorebookId: lorebook.sourceLorebookId ?? undefined,
      createdAt: lorebook.createdAt,
      updatedAt: lorebook.updatedAt,
    };
  },

  async findByCharacterId(
    characterId: string,
  ): Promise<CharacterLorebook | null> {
    const [lorebook] = await pgDb
      .select()
      .from(CharacterLorebookSchema)
      .where(eq(CharacterLorebookSchema.characterId, characterId))
      .limit(1);

    if (!lorebook) return null;

    return {
      id: lorebook.id,
      characterId: lorebook.characterId,
      name: lorebook.name,
      entries: lorebook.entries,
      isEmbedded: lorebook.isEmbedded,
      sourceLorebookId: lorebook.sourceLorebookId ?? undefined,
      createdAt: lorebook.createdAt,
      updatedAt: lorebook.updatedAt,
    };
  },

  async findAllByCharacterId(
    characterId: string,
  ): Promise<CharacterLorebook[]> {
    const lorebooks = await pgDb
      .select()
      .from(CharacterLorebookSchema)
      .where(eq(CharacterLorebookSchema.characterId, characterId));

    return lorebooks.map((lb) => ({
      id: lb.id,
      characterId: lb.characterId,
      name: lb.name,
      entries: lb.entries,
      isEmbedded: lb.isEmbedded,
      sourceLorebookId: lb.sourceLorebookId ?? undefined,
      createdAt: lb.createdAt,
      updatedAt: lb.updatedAt,
    }));
  },

  async update(
    id: string,
    characterId: string,
    data: Partial<LorebookCreate>,
  ): Promise<CharacterLorebook> {
    const [lorebook] = await pgDb
      .update(CharacterLorebookSchema)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(CharacterLorebookSchema.id, id),
          eq(CharacterLorebookSchema.characterId, characterId),
        ),
      )
      .returning();

    if (!lorebook) {
      throw new Error("Lorebook not found");
    }

    return {
      id: lorebook.id,
      characterId: lorebook.characterId,
      name: lorebook.name,
      entries: lorebook.entries,
      isEmbedded: lorebook.isEmbedded,
      sourceLorebookId: lorebook.sourceLorebookId ?? undefined,
      createdAt: lorebook.createdAt,
      updatedAt: lorebook.updatedAt,
    };
  },

  async delete(id: string, characterId: string): Promise<void> {
    await pgDb
      .delete(CharacterLorebookSchema)
      .where(
        and(
          eq(CharacterLorebookSchema.id, id),
          eq(CharacterLorebookSchema.characterId, characterId),
        ),
      );
  },

  async deleteAllForCharacter(characterId: string): Promise<void> {
    await pgDb
      .delete(CharacterLorebookSchema)
      .where(eq(CharacterLorebookSchema.characterId, characterId));
  },
};
