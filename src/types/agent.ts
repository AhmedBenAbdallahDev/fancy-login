import z from "zod";
import { ChatMention, ChatMentionSchema } from "./chat";

export type AgentIcon = {
  type: "emoji";
  value: string;
  style?: Record<string, string>;
};

export const AgentUpsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(100),
  tagline: z.string().max(200).optional(),
  description: z.string().max(8000).optional(),
  avatar: z.string().optional(),
  isPublic: z.boolean().optional().default(false),
  icon: z
    .object({
      type: z.literal("emoji"),
      value: z.string(),
      style: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
  instructions: z.object({
    role: z.string().optional(),
    systemPrompt: z.string().optional(),
    mentions: z.array(ChatMentionSchema).optional(),
  }),
});

export type Agent = {
  id: string;
  name: string;
  tagline?: string;
  description?: string;
  avatar?: string;
  icon?: AgentIcon;
  userId: string;
  isPublic?: boolean;
  instructions: {
    role?: string;
    systemPrompt?: string;
    mentions?: ChatMention[];
  };
  // Stats
  chatCount?: number;
  likeCount?: number;
  createdAt: Date;
  updatedAt: Date;
};

export type AgentRepository = {
  insertAgent(
    agent: Omit<Agent, "id" | "createdAt" | "updatedAt">,
  ): Promise<Agent>;

  selectAgentById(id: string, userId: string): Promise<Agent | null>;

  selectAgentsByUserId(userId: string): Promise<Omit<Agent, "instructions">[]>;

  updateAgent(
    id: string,
    userId: string,
    agent: Partial<
      Pick<
        Agent,
        | "name"
        | "tagline"
        | "description"
        | "avatar"
        | "icon"
        | "instructions"
        | "isPublic"
      >
    >,
  ): Promise<Agent>;

  upsertAgent(
    agent: Omit<Agent, "id" | "createdAt" | "updatedAt"> & { id?: string },
  ): Promise<Agent>;

  deleteAgent(id: string, userId: string): Promise<void>;

  selectPublicAgents(): Promise<
    (Omit<Agent, "instructions"> & { creatorName?: string })[]
  >;

  selectPublicAgentById(id: string): Promise<Agent | null>;
};

export const AgentGenerateSchema = z.object({
  name: z.string().describe("Agent name"),
  description: z.string().describe("Agent description"),
  instructions: z.string().describe("Agent instructions"),
  role: z.string().describe("Agent role"),
  tools: z
    .array(z.string())
    .describe("Agent allowed tools name")
    .optional()
    .default([]),
});
