import { z } from "zod";

export type UserPreferences = {
  displayName?: string;
  profession?: string; // User's job or profession
  responseStyleExample?: string; // Example of preferred response style
  botName?: string; // Name of the bot
  roleplay?: {
    narrationOpacity?: number; // 0.2 - 1.0, opacity for *narration* text in RP chats
  };
  apiKeys?: Record<string, string>; // API keys for different providers
  generation?: {
    // Default cap for total context window (prompt + completion)
    maxContextTokensDefault?: number;
    // Per-model override. Key format: "provider:model"
    maxContextTokensByModel?: Record<string, number>;
    // Advanced generation controls (only used when enabled)
    advanced?: {
      enabled?: boolean;
      temperature?: number;
      topP?: number;
      topK?: number;
      maxOutputTokens?: number;
    };
  };
};

export type User = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  preferences?: UserPreferences;
};

export type UserRepository = {
  existsByEmail: (email: string) => Promise<boolean>;
  updateUser: (
    id: string,
    user: Partial<Pick<User, "name" | "image">>,
  ) => Promise<User>;
  updatePreferences: (
    userId: string,
    preferences: UserPreferences,
  ) => Promise<User>;
  getPreferences: (userId: string) => Promise<UserPreferences | null>;
  findById: (userId: string) => Promise<User | null>;
};

export const UserZodSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

export const UserPreferencesZodSchema = z.object({
  displayName: z.string().optional(),
  profession: z.string().optional(),
  responseStyleExample: z.string().optional(),
  botName: z.string().optional(),
  roleplay: z
    .object({
      narrationOpacity: z.number().min(0.2).max(1).optional(),
    })
    .optional(),
  apiKeys: z.record(z.string()).optional(),
  generation: z
    .object({
      maxContextTokensDefault: z
        .number()
        .int()
        .min(1024)
        .max(200000)
        .optional(),
      maxContextTokensByModel: z
        .record(z.number().int().min(1024).max(200000))
        .optional(),
      advanced: z
        .object({
          enabled: z.boolean().optional(),
          temperature: z.number().min(0).max(2).optional(),
          topP: z.number().min(0).max(1).optional(),
          topK: z.number().int().min(1).max(10000).optional(),
          maxOutputTokens: z.number().int().min(1).max(32768).optional(),
        })
        .optional(),
    })
    .optional(),
});
