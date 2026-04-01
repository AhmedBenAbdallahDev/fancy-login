import { eq, and, desc, sql, ilike, or, asc } from "drizzle-orm";
import { pgDb as db } from "../db.pg";
import {
  CharacterSchema,
  CharacterLikeSchema,
  CharacterCommentSchema,
} from "../schema.pg";
import {
  Character,
  CharacterSummary,
  CharacterCreate,
  CharacterUpdate,
  CharacterRepository,
  CharacterComment,
} from "app-types/character";
import { generateUUID } from "lib/utils";

// Helper to convert DB row to CharacterSummary
function toCharacterSummary(row: any): CharacterSummary {
  return {
    id: row.id,
    userId: row.userId,
    creatorUsername: row.creatorUsername ?? undefined,
    name: row.name,
    tagline: row.tagline ?? undefined,
    avatar: row.avatar ?? undefined,
    tags: row.tags ?? [],
    isPublic: row.isPublic,
    isNSFW: row.isNSFW,
    chatCount: row.chatCount,
    messageCount: row.messageCount ?? 0,
    likeCount: row.likeCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Helper to convert DB row to Character
function toCharacter(row: any): Character {
  return {
    id: row.id,
    userId: row.userId,
    creatorUsername: row.creatorUsername ?? undefined,
    name: row.name,
    tagline: row.tagline ?? undefined,
    description: row.description ?? undefined,
    avatar: row.avatar ?? undefined,
    personality: row.personality ?? undefined,
    systemPrompt: row.systemPrompt ?? undefined,
    greeting: row.greeting ?? undefined,
    exampleDialogue: row.exampleDialogue ?? undefined,
    tags: row.tags ?? [],
    isPublic: row.isPublic,
    isNSFW: row.isNSFW,
    chatCount: row.chatCount,
    messageCount: row.messageCount ?? 0,
    likeCount: row.likeCount,
    allowedTools: row.allowedTools ?? [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const pgCharacterRepository: CharacterRepository = {
  async create(userId: string, data: CharacterCreate): Promise<Character> {
    const [result] = await db
      .insert(CharacterSchema)
      .values({
        id: generateUUID(),
        userId,
        name: data.name,
        tagline: data.tagline,
        description: data.description,
        avatar: data.avatar,
        personality: data.personality,
        systemPrompt: data.systemPrompt,
        greeting: data.greeting,
        exampleDialogue: data.exampleDialogue,
        tags: data.tags ?? [],
        isPublic: data.isPublic ?? false,
        isNSFW: data.isNSFW ?? false,
        allowedTools: data.allowedTools ?? [],
        chatCount: 0,
        messageCount: 0,
        likeCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return toCharacter(result);
  },

  async findById(id: string): Promise<Character | null> {
    const [result] = await db
      .select()
      .from(CharacterSchema)
      .where(eq(CharacterSchema.id, id));

    return result ? toCharacter(result) : null;
  },

  async findByIdForUser(id: string, userId: string): Promise<Character | null> {
    const [result] = await db
      .select()
      .from(CharacterSchema)
      .where(
        and(
          eq(CharacterSchema.id, id),
          or(
            eq(CharacterSchema.userId, userId),
            eq(CharacterSchema.isPublic, true),
          ),
        ),
      );

    return result ? toCharacter(result) : null;
  },

  async findByUserId(userId: string): Promise<CharacterSummary[]> {
    const results = await db
      .select()
      .from(CharacterSchema)
      .where(eq(CharacterSchema.userId, userId))
      .orderBy(desc(CharacterSchema.updatedAt));

    return results.map((r) => toCharacterSummary(r));
  },

  async update(
    id: string,
    userId: string,
    data: CharacterUpdate,
  ): Promise<Character> {
    const [result] = await db
      .update(CharacterSchema)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(eq(CharacterSchema.id, id), eq(CharacterSchema.userId, userId)),
      )
      .returning();

    return toCharacter(result);
  },

  async delete(id: string, userId: string): Promise<void> {
    await db
      .delete(CharacterSchema)
      .where(
        and(eq(CharacterSchema.id, id), eq(CharacterSchema.userId, userId)),
      );
  },

  async findPublic(
    options: {
      limit?: number;
      offset?: number;
      search?: string;
      sortBy?: "popular" | "newest" | "name" | "likes";
      creatorUsername?: string;
    } = {},
  ): Promise<CharacterSummary[]> {
    const {
      limit = 50,
      offset = 0,
      search,
      sortBy = "popular",
      creatorUsername,
    } = options;

    // Public discover should never fail if userId is non-uuid (e.g., GitHub numeric IDs).
    // Drop the user join to avoid invalid cast errors and ensure public rows always show.
    let query = db
      .select({
        id: CharacterSchema.id,
        userId: CharacterSchema.userId,
        creatorUsername: CharacterSchema.creatorUsername,
        name: CharacterSchema.name,
        tagline: CharacterSchema.tagline,
        avatar: CharacterSchema.avatar,
        tags: CharacterSchema.tags,
        isPublic: CharacterSchema.isPublic,
        isNSFW: CharacterSchema.isNSFW,
        chatCount: CharacterSchema.chatCount,
        messageCount: CharacterSchema.messageCount,
        likeCount: CharacterSchema.likeCount,
        createdAt: CharacterSchema.createdAt,
        updatedAt: CharacterSchema.updatedAt,
      })
      .from(CharacterSchema)
      .where(eq(CharacterSchema.isPublic, true))
      .$dynamic();

    // Filter by creator username
    if (creatorUsername) {
      query = query.where(
        eq(CharacterSchema.creatorUsername, creatorUsername.toLowerCase()),
      );
    }

    // Add search filter
    if (search) {
      query = query.where(
        or(
          ilike(CharacterSchema.name, `%${search}%`),
          ilike(CharacterSchema.tagline, `%${search}%`),
          ilike(CharacterSchema.description, `%${search}%`),
        ),
      );
    }

    // Add sorting
    switch (sortBy) {
      case "popular":
        query = query.orderBy(
          desc(CharacterSchema.messageCount),
          desc(CharacterSchema.chatCount),
        );
        break;
      case "newest":
        query = query.orderBy(desc(CharacterSchema.createdAt));
        break;
      case "name":
        query = query.orderBy(asc(CharacterSchema.name));
        break;
      case "likes":
        query = query.orderBy(
          desc(CharacterSchema.likeCount),
          desc(CharacterSchema.chatCount),
        );
        break;
    }

    const results = await query.limit(limit).offset(offset);

    return results.map((r) => toCharacterSummary(r));
  },

  async findPublicById(id: string): Promise<Character | null> {
    const [result] = await db
      .select()
      .from(CharacterSchema)
      .where(
        and(eq(CharacterSchema.id, id), eq(CharacterSchema.isPublic, true)),
      );

    return result ? toCharacter(result) : null;
  },

  async incrementChatCount(id: string): Promise<void> {
    await db
      .update(CharacterSchema)
      .set({
        chatCount: sql`${CharacterSchema.chatCount} + 1`,
      })
      .where(eq(CharacterSchema.id, id));
  },

  async incrementMessageCount(id: string): Promise<void> {
    await db
      .update(CharacterSchema)
      .set({
        messageCount: sql`${CharacterSchema.messageCount} + 1`,
      })
      .where(eq(CharacterSchema.id, id));
  },

  async like(characterId: string, userId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Insert like
      await tx
        .insert(CharacterLikeSchema)
        .values({
          id: generateUUID(),
          characterId,
          userId,
          createdAt: new Date(),
        })
        .onConflictDoNothing();

      // Increment like count
      await tx
        .update(CharacterSchema)
        .set({
          likeCount: sql`${CharacterSchema.likeCount} + 1`,
        })
        .where(eq(CharacterSchema.id, characterId));
    });
  },

  async unlike(characterId: string, userId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Delete like
      const result = await tx
        .delete(CharacterLikeSchema)
        .where(
          and(
            eq(CharacterLikeSchema.characterId, characterId),
            eq(CharacterLikeSchema.userId, userId),
          ),
        )
        .returning();

      // Decrement like count only if we actually deleted something
      if (result.length > 0) {
        await tx
          .update(CharacterSchema)
          .set({
            likeCount: sql`GREATEST(${CharacterSchema.likeCount} - 1, 0)`,
          })
          .where(eq(CharacterSchema.id, characterId));
      }
    });
  },

  async isLikedByUser(characterId: string, userId: string): Promise<boolean> {
    const [result] = await db
      .select()
      .from(CharacterLikeSchema)
      .where(
        and(
          eq(CharacterLikeSchema.characterId, characterId),
          eq(CharacterLikeSchema.userId, userId),
        ),
      );

    return !!result;
  },

  async getLikedByUser(userId: string): Promise<CharacterSummary[]> {
    const results = await db
      .select({
        id: CharacterSchema.id,
        userId: CharacterSchema.userId,
        name: CharacterSchema.name,
        tagline: CharacterSchema.tagline,
        avatar: CharacterSchema.avatar,
        tags: CharacterSchema.tags,
        isPublic: CharacterSchema.isPublic,
        isNSFW: CharacterSchema.isNSFW,
        chatCount: CharacterSchema.chatCount,
        messageCount: CharacterSchema.messageCount,
        likeCount: CharacterSchema.likeCount,
        createdAt: CharacterSchema.createdAt,
        updatedAt: CharacterSchema.updatedAt,
        creatorUsername: CharacterSchema.creatorUsername,
      })
      .from(CharacterLikeSchema)
      .innerJoin(
        CharacterSchema,
        eq(CharacterLikeSchema.characterId, CharacterSchema.id),
      )
      .where(eq(CharacterLikeSchema.userId, userId))
      .orderBy(desc(CharacterLikeSchema.createdAt));

    return results.map((r) => toCharacterSummary(r));
  },

  // Comments
  async addComment(
    characterId: string,
    userId: string,
    userName: string,
    userAvatar: string | undefined,
    content: string,
  ): Promise<CharacterComment> {
    const [result] = await db
      .insert(CharacterCommentSchema)
      .values({
        id: generateUUID(),
        characterId,
        userId,
        userName,
        userAvatar,
        content,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return {
      id: result.id,
      characterId: result.characterId,
      userId: result.userId,
      userName: result.userName,
      userAvatar: result.userAvatar ?? undefined,
      content: result.content,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  },

  async getComments(
    characterId: string,
    limit = 50,
    offset = 0,
  ): Promise<CharacterComment[]> {
    const results = await db
      .select()
      .from(CharacterCommentSchema)
      .where(eq(CharacterCommentSchema.characterId, characterId))
      .orderBy(desc(CharacterCommentSchema.createdAt))
      .limit(limit)
      .offset(offset);

    return results.map((r) => ({
      id: r.id,
      characterId: r.characterId,
      userId: r.userId,
      userName: r.userName,
      userAvatar: r.userAvatar ?? undefined,
      content: r.content,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  },

  async deleteComment(commentId: string, userId: string): Promise<void> {
    await db
      .delete(CharacterCommentSchema)
      .where(
        and(
          eq(CharacterCommentSchema.id, commentId),
          eq(CharacterCommentSchema.userId, userId),
        ),
      );
  },
};
