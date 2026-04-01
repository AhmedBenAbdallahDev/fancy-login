import { eq, sql } from "drizzle-orm";
import { pgDb as db } from "../db.pg";
import { CreatorProfileSchema } from "../schema.pg";
import {
  CreatorProfile,
  CreatorProfileCreate,
  CreatorProfileUpdate,
  CreatorProfileRepository,
} from "app-types/creator";
import { generateUUID } from "lib/utils";

// Helper to convert DB row to CreatorProfile
function toCreatorProfile(row: any): CreatorProfile {
  return {
    id: row.id,
    userId: row.userId,
    username: row.username,
    displayName: row.displayName,
    bio: row.bio ?? undefined,
    avatar: row.avatar ?? undefined,
    bannerImage: row.bannerImage ?? undefined,
    socialLinks: row.socialLinks ?? undefined,
    isVerified: row.isVerified,
    followerCount: row.followerCount,
    botCount: row.botCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const pgCreatorProfileRepository: CreatorProfileRepository = {
  async create(
    userId: string,
    data: CreatorProfileCreate,
  ): Promise<CreatorProfile> {
    // Normalize username to lowercase
    const normalizedUsername = data.username.toLowerCase();

    const [result] = await db
      .insert(CreatorProfileSchema)
      .values({
        id: generateUUID(),
        userId,
        username: normalizedUsername,
        displayName: data.displayName,
        bio: data.bio,
        avatar: data.avatar,
        isVerified: false,
        followerCount: 0,
        botCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return toCreatorProfile(result);
  },

  async findById(id: string): Promise<CreatorProfile | null> {
    const [result] = await db
      .select()
      .from(CreatorProfileSchema)
      .where(eq(CreatorProfileSchema.id, id));

    return result ? toCreatorProfile(result) : null;
  },

  async findByUserId(userId: string): Promise<CreatorProfile | null> {
    const [result] = await db
      .select()
      .from(CreatorProfileSchema)
      .where(eq(CreatorProfileSchema.userId, userId));

    return result ? toCreatorProfile(result) : null;
  },

  async findByUsername(username: string): Promise<CreatorProfile | null> {
    // Case-insensitive lookup
    const normalizedUsername = username.toLowerCase();
    const [result] = await db
      .select()
      .from(CreatorProfileSchema)
      .where(eq(CreatorProfileSchema.username, normalizedUsername));

    return result ? toCreatorProfile(result) : null;
  },

  async update(
    userId: string,
    data: CreatorProfileUpdate,
  ): Promise<CreatorProfile> {
    const [result] = await db
      .update(CreatorProfileSchema)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(CreatorProfileSchema.userId, userId))
      .returning();

    return toCreatorProfile(result);
  },

  async isUsernameAvailable(username: string): Promise<boolean> {
    const normalizedUsername = username.toLowerCase();
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(CreatorProfileSchema)
      .where(eq(CreatorProfileSchema.username, normalizedUsername));

    return Number(result?.count ?? 0) === 0;
  },

  async incrementBotCount(userId: string): Promise<void> {
    await db
      .update(CreatorProfileSchema)
      .set({
        botCount: sql`${CreatorProfileSchema.botCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(CreatorProfileSchema.userId, userId));
  },

  async decrementBotCount(userId: string): Promise<void> {
    await db
      .update(CreatorProfileSchema)
      .set({
        botCount: sql`GREATEST(${CreatorProfileSchema.botCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(CreatorProfileSchema.userId, userId));
  },
};
