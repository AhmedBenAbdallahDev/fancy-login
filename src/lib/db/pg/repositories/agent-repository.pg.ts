import { Agent, AgentRepository } from "app-types/agent";
import { pgDb as db } from "../db.pg";
import { AgentSchema, UserSchema } from "../schema.pg";
import { and, desc, eq, sql } from "drizzle-orm";
import { generateUUID } from "lib/utils";

// Helper to cast UUID to text for comparison with AgentSchema.userId (text column)
const castUuidToText = (uuid: any) => sql`${uuid}::text`;

export const pgAgentRepository: AgentRepository = {
  async insertAgent(agent) {
    const [result] = await db
      .insert(AgentSchema)
      .values({
        id: generateUUID(),
        name: agent.name,
        tagline: agent.tagline,
        description: agent.description,
        avatar: agent.avatar,
        icon: agent.icon,
        userId: agent.userId,
        isPublic: agent.isPublic ?? false,
        instructions: agent.instructions,
        chatCount: 0,
        likeCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return result as Agent;
  },

  async selectAgentById(id, userId) {
    const [result] = await db
      .select()
      .from(AgentSchema)
      .where(
        and(eq(AgentSchema.id, id), eq(AgentSchema.userId, String(userId))),
      );

    if (!result) return null;

    return {
      ...result,
      tagline: result.tagline ?? undefined,
      description: result.description ?? undefined,
      avatar: result.avatar ?? undefined,
      icon: result.icon ?? undefined,
    } as Agent;
  },

  async selectAgentsByUserId(userId) {
    const results = await db
      .select({
        id: AgentSchema.id,
        name: AgentSchema.name,
        tagline: AgentSchema.tagline,
        description: AgentSchema.description,
        avatar: AgentSchema.avatar,
        icon: AgentSchema.icon,
        userId: AgentSchema.userId,
        isPublic: AgentSchema.isPublic,
        chatCount: AgentSchema.chatCount,
        likeCount: AgentSchema.likeCount,
        createdAt: AgentSchema.createdAt,
        updatedAt: AgentSchema.updatedAt,
        creatorName: UserSchema.name,
      })
      .from(AgentSchema)
      // Use leftJoin with text cast - AgentSchema.userId is text, UserSchema.id is uuid
      .leftJoin(
        UserSchema,
        eq(AgentSchema.userId, castUuidToText(UserSchema.id)),
      )
      .where(eq(AgentSchema.userId, String(userId)))
      .orderBy(desc(AgentSchema.updatedAt));

    // Convert null values to undefined to match Agent type
    return results.map((result) => ({
      ...result,
      tagline: result.tagline ?? undefined,
      description: result.description ?? undefined,
      avatar: result.avatar ?? undefined,
      icon: result.icon ?? undefined,
      creatorName: result.creatorName ?? undefined,
    })) as Omit<Agent, "instructions">[];
  },

  async updateAgent(id, userId, agent) {
    const [result] = await db
      .update(AgentSchema)
      .set({
        ...(agent as object),
        updatedAt: new Date(),
      })
      .where(
        and(eq(AgentSchema.id, id), eq(AgentSchema.userId, String(userId))),
      )
      .returning();
    return result as Agent;
  },

  async upsertAgent(agent) {
    const [result] = await db
      .insert(AgentSchema)
      .values({
        id: agent.id || generateUUID(),
        name: agent.name,
        tagline: agent.tagline,
        description: agent.description,
        avatar: agent.avatar,
        icon: agent.icon,
        userId: agent.userId,
        isPublic: agent.isPublic ?? false,
        instructions: agent.instructions,
        chatCount: 0,
        likeCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [AgentSchema.id],
        set: {
          name: agent.name,
          tagline: agent.tagline,
          description: agent.description,
          avatar: agent.avatar,
          icon: agent.icon,
          isPublic: agent.isPublic ?? false,
          instructions: agent.instructions,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result as Agent;
  },

  async deleteAgent(id, userId) {
    await db
      .delete(AgentSchema)
      .where(
        and(eq(AgentSchema.id, id), eq(AgentSchema.userId, String(userId))),
      );
  },

  async selectPublicAgents() {
    const results = await db
      .select({
        id: AgentSchema.id,
        name: AgentSchema.name,
        tagline: AgentSchema.tagline,
        description: AgentSchema.description,
        avatar: AgentSchema.avatar,
        icon: AgentSchema.icon,
        userId: AgentSchema.userId,
        isPublic: AgentSchema.isPublic,
        chatCount: AgentSchema.chatCount,
        likeCount: AgentSchema.likeCount,
        createdAt: AgentSchema.createdAt,
        updatedAt: AgentSchema.updatedAt,
        creatorName: UserSchema.name,
      })
      .from(AgentSchema)
      // Use leftJoin with text cast - AgentSchema.userId is text, UserSchema.id is uuid
      .leftJoin(
        UserSchema,
        eq(AgentSchema.userId, castUuidToText(UserSchema.id)),
      )
      .where(eq(AgentSchema.isPublic, true))
      .orderBy(desc(AgentSchema.chatCount), desc(AgentSchema.updatedAt));

    // Convert null values to undefined to match Agent type
    return results.map((result) => ({
      ...result,
      tagline: result.tagline ?? undefined,
      description: result.description ?? undefined,
      avatar: result.avatar ?? undefined,
      icon: result.icon ?? undefined,
      creatorName: result.creatorName ?? undefined,
    }));
  },

  async selectPublicAgentById(id: string) {
    const [result] = await db
      .select()
      .from(AgentSchema)
      .where(and(eq(AgentSchema.id, id), eq(AgentSchema.isPublic, true)));

    if (!result) return null;

    // Convert null values to undefined to match Agent type
    return {
      ...result,
      tagline: result.tagline ?? undefined,
      description: result.description ?? undefined,
      avatar: result.avatar ?? undefined,
      icon: result.icon ?? undefined,
    } as Agent;
  },
};
