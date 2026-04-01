import { z } from "zod";

// ============================================================================
// STYLE PRESET - Global writing style for chats
// ============================================================================

export interface StylePreset {
  id: string;
  userId: string;
  name: string;
  description?: string;
  systemPrompt: string; // The style rules/instructions
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const StylePresetCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  systemPrompt: z.string().min(1).max(10000),
  isDefault: z.boolean().optional().default(false),
});

export const StylePresetUpdateSchema = StylePresetCreateSchema.partial();

export type StylePresetCreate = z.infer<typeof StylePresetCreateSchema>;
export type StylePresetUpdate = z.infer<typeof StylePresetUpdateSchema>;

export type StylePresetRepository = {
  create(userId: string, data: StylePresetCreate): Promise<StylePreset>;
  findById(id: string, userId: string): Promise<StylePreset | null>;
  findByUserId(userId: string): Promise<StylePreset[]>;
  findDefault(userId: string): Promise<StylePreset | null>;
  update(
    id: string,
    userId: string,
    data: StylePresetUpdate,
  ): Promise<StylePreset>;
  setDefault(id: string, userId: string): Promise<void>;
  delete(id: string, userId: string): Promise<void>;
};

// ============================================================================
// DEFAULT STYLE PRESETS (Templates)
// ============================================================================

export const DEFAULT_STYLE_PRESETS: Omit<
  StylePreset,
  "id" | "userId" | "createdAt" | "updatedAt"
>[] = [
  {
    name: "Novel / Narrative",
    description: "Immersive third-person narrative style like a novel",
    isDefault: true,
    systemPrompt: `## Writing Style: Novel/Narrative

Write responses in an immersive, narrative style:

- Use third-person perspective for narration
- Put actions and descriptions between *asterisks*
- Write 2-4 paragraphs per response
- Be descriptive and atmospheric
- No bold text, no bullet points, no markdown formatting
- No OOC (out of character) comments
- Stay fully immersed in the scene

Example format:
*She tilted her head curiously, a gentle smile forming on her lips.* "I didn't expect to see you here," *she said softly, tucking a strand of hair behind her ear.*`,
  },
  {
    name: "Chat / DM Style",
    description: "Casual first-person conversational style",
    isDefault: false,
    systemPrompt: `## Writing Style: Chat/DM

Write responses in a casual, conversational style:

- Use first-person perspective
- Keep responses shorter and punchy
- Actions in *asterisks* are optional but encouraged
- Can use emojis occasionally if it fits the character
- Feel free to use casual language
- Quick back-and-forth dialogue is great

Example format:
*waves* Hey! What's up? I was just thinking about you actually haha`,
  },
  {
    name: "Script / Screenplay",
    description: "Formatted like a screenplay or script",
    isDefault: false,
    systemPrompt: `## Writing Style: Script/Screenplay

Write responses like a screenplay:

- Put character name before dialogue (can be implied)
- Actions and stage directions in (parentheses)
- Keep dialogue natural and snappy
- Focus on dialogue over narration
- Minimal description, maximum impact

Example format:
(leaning against the doorframe, arms crossed)
You know, I've been waiting for you to show up.
(smirks)
Took you long enough.`,
  },
  {
    name: "Roleplay / Action Focus",
    description: "Action-heavy with clear formatting",
    isDefault: false,
    systemPrompt: `## Writing Style: Roleplay/Action Focus

Write responses with clear action and dialogue separation:

- Actions between *asterisks*
- Dialogue in "quotes"
- Keep a balance between action and dialogue
- Be descriptive with physical actions
- Emotions shown through actions, not stated
- No OOC, stay in character

Example format:
*She drew her sword in one fluid motion, the blade catching the moonlight.* "You shouldn't have come here," *she warned, her voice cold as steel.*`,
  },
];
