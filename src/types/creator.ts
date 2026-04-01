import { z } from "zod";

// ============================================================================
// CREATOR PROFILE - Public identity for publishing bots & commenting
// ============================================================================

export interface CreatorProfile {
  id: string;
  userId: string;
  username: string; // @username (unique, lowercase)
  displayName: string;
  bio?: string; // Long description/about me (up to 2000 chars)
  avatar?: string;
  bannerImage?: string; // Profile banner
  socialLinks?: {
    twitter?: string;
    discord?: string;
    website?: string;
  };
  isVerified: boolean;
  followerCount: number;
  botCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// For displaying in lists
export interface CreatorSummary {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  isVerified: boolean;
  botCount: number;
}

// Username validation rules
const usernameRegex = /^[a-z0-9_]{3,20}$/;

export const UsernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username must be at most 20 characters")
  .regex(
    usernameRegex,
    "Username can only contain lowercase letters, numbers, and underscores",
  )
  .transform((val) => val.toLowerCase());

export const SocialLinksSchema = z
  .object({
    twitter: z.string().max(100).optional(),
    discord: z.string().max(100).optional(),
    website: z.string().url().max(200).optional(),
  })
  .optional();

export const CreatorProfileCreateSchema = z.object({
  username: UsernameSchema,
  displayName: z.string().min(1).max(50),
  bio: z.string().max(2000).optional(), // Increased to 2000 chars
  avatar: z.string().optional(),
});

export const CreatorProfileUpdateSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  bio: z.string().max(2000).optional(),
  avatar: z.string().optional(),
  bannerImage: z.string().optional(),
  socialLinks: SocialLinksSchema,
});

export type CreatorProfileCreate = z.infer<typeof CreatorProfileCreateSchema>;
export type CreatorProfileUpdate = z.infer<typeof CreatorProfileUpdateSchema>;

// Repository interface
export interface CreatorProfileRepository {
  // CRUD
  create(userId: string, data: CreatorProfileCreate): Promise<CreatorProfile>;
  findById(id: string): Promise<CreatorProfile | null>;
  findByUserId(userId: string): Promise<CreatorProfile | null>;
  findByUsername(username: string): Promise<CreatorProfile | null>;
  update(userId: string, data: CreatorProfileUpdate): Promise<CreatorProfile>;

  // Validation
  isUsernameAvailable(username: string): Promise<boolean>;

  // Stats
  incrementBotCount(userId: string): Promise<void>;
  decrementBotCount(userId: string): Promise<void>;
}
