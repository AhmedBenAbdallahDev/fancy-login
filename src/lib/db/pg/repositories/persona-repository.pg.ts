import { eq, and, desc } from "drizzle-orm";
import { pgDb as db } from "../db.pg";
import { PersonaSchema } from "../schema.pg";
import {
  Persona,
  PersonaCreate,
  PersonaUpdate,
  PersonaRepository,
} from "app-types/persona";
import { generateUUID } from "lib/utils";

export const pgPersonaRepository: PersonaRepository = {
  async create(userId: string, data: PersonaCreate): Promise<Persona> {
    // If this is set as default, unset any existing default
    if (data.isDefault) {
      await db
        .update(PersonaSchema)
        .set({ isDefault: false })
        .where(eq(PersonaSchema.userId, userId));
    }

    const [result] = await db
      .insert(PersonaSchema)
      .values({
        id: generateUUID(),
        userId,
        name: data.name,
        description: data.description,
        personality: data.personality,
        avatar: data.avatar,
        isDefault: data.isDefault ?? false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return {
      ...result,
      description: result.description ?? undefined,
      personality: result.personality ?? undefined,
      avatar: result.avatar ?? undefined,
    } as Persona;
  },

  async findById(id: string, userId: string): Promise<Persona | null> {
    const [result] = await db
      .select()
      .from(PersonaSchema)
      .where(and(eq(PersonaSchema.id, id), eq(PersonaSchema.userId, userId)));

    if (!result) return null;

    return {
      ...result,
      description: result.description ?? undefined,
      personality: result.personality ?? undefined,
      avatar: result.avatar ?? undefined,
    } as Persona;
  },

  async findByUserId(userId: string): Promise<Persona[]> {
    const results = await db
      .select()
      .from(PersonaSchema)
      .where(eq(PersonaSchema.userId, userId))
      .orderBy(desc(PersonaSchema.isDefault), desc(PersonaSchema.updatedAt));

    return results.map((r) => ({
      ...r,
      description: r.description ?? undefined,
      personality: r.personality ?? undefined,
      avatar: r.avatar ?? undefined,
    })) as Persona[];
  },

  async findDefault(userId: string): Promise<Persona | null> {
    const [result] = await db
      .select()
      .from(PersonaSchema)
      .where(
        and(
          eq(PersonaSchema.userId, userId),
          eq(PersonaSchema.isDefault, true),
        ),
      );

    if (!result) return null;

    return {
      ...result,
      description: result.description ?? undefined,
      personality: result.personality ?? undefined,
      avatar: result.avatar ?? undefined,
    } as Persona;
  },

  async update(
    id: string,
    userId: string,
    data: PersonaUpdate,
  ): Promise<Persona> {
    // If setting as default, unset any existing default first
    if (data.isDefault) {
      await db
        .update(PersonaSchema)
        .set({ isDefault: false })
        .where(eq(PersonaSchema.userId, userId));
    }

    const [result] = await db
      .update(PersonaSchema)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(PersonaSchema.id, id), eq(PersonaSchema.userId, userId)))
      .returning();

    return {
      ...result,
      description: result.description ?? undefined,
      personality: result.personality ?? undefined,
      avatar: result.avatar ?? undefined,
    } as Persona;
  },

  async delete(id: string, userId: string): Promise<void> {
    await db
      .delete(PersonaSchema)
      .where(and(eq(PersonaSchema.id, id), eq(PersonaSchema.userId, userId)));
  },

  async setDefault(id: string, userId: string): Promise<Persona> {
    // Unset all defaults for this user
    await db
      .update(PersonaSchema)
      .set({ isDefault: false })
      .where(eq(PersonaSchema.userId, userId));

    // Set the new default
    const [result] = await db
      .update(PersonaSchema)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(and(eq(PersonaSchema.id, id), eq(PersonaSchema.userId, userId)))
      .returning();

    return {
      ...result,
      description: result.description ?? undefined,
      personality: result.personality ?? undefined,
      avatar: result.avatar ?? undefined,
    } as Persona;
  },
};
