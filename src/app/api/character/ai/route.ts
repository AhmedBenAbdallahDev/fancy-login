import { streamObject } from "ai";

import { customModelProvider } from "lib/ai/models";
import globalLogger from "logger";
import { ChatModel } from "app-types/chat";

import { getSession } from "auth/server";
import { colorize } from "consola/utils";
import { CharacterGenerateSchema } from "app-types/character";
import { z } from "zod";

const logger = globalLogger.withDefaults({
  message: colorize("blackBright", `Character Generate API: `),
});

// RP Character Generation System Prompt - Focused on roleplay, not agent tasks
const CHARACTER_GENERATION_PROMPT = `You are an expert at creating compelling AI roleplay characters for interactive storytelling.

# CRITICAL: YOU MUST CREATE THE EXACT CHARACTER THE USER DESCRIBES
- If the user says "Alicia, a punk rock childhood friend" - create Alicia, a punk rock childhood friend
- If the user says "a vampire prince" - create a vampire prince
- NEVER ignore the user's request and create something random
- Use the EXACT name the user provides, or create one that fits their description
- Match the genre/setting the user specifies (modern, fantasy, sci-fi, etc.)

# Character Profile Structure

## Name
- Use the name the user provides, or create one fitting their description

## Tagline
- A short, catchy one-liner that captures the character's essence

## Description (Backstory)
- Write a rich backstory based on the user's description
- Include their history, motivations, current situation
- Add details that make them feel real and three-dimensional

## Personality
- Define their core personality traits based on user's request
- Describe how they typically behave and react
- Include quirks, habits, or mannerisms that make them unique

## System Prompt (Character Instructions)
Write RP instructions for the AI to embody this character:
- **Voice & Speech Style**: How they talk (formal/casual, slang, catchphrases)
- **Tone**: Their general demeanor
- **Behavior Patterns**: How they react to situations
- **Roleplay Guidelines**: Use *asterisks* for actions and emotions

Example: "You are [Name], a [description]. Speak in [style]. You often [habits]. Never break character. Use *asterisks* for actions."

## Greeting (First Message)
- An engaging opening message from the character's perspective
- Set the scene and draw the user in
- Include actions in *asterisks* and dialogue

## Example Dialogue
Format:
{{char}}: [Character's line with *actions*]
{{user}}: [Example user response]
{{char}}: [Character's response]

# Rules
- ALWAYS follow the user's character description exactly
- Match the language of the user's request
- Focus on ROLEPLAY elements, not AI assistant instructions
- Characters should feel like real people with depth`;

export async function POST(request: Request) {
  try {
    const json = await request.json();

    const { chatModel, message = "hello" } = json as {
      chatModel?: ChatModel;
      message: string;
    };

    logger.info(`chatModel: ${chatModel?.provider}/${chatModel?.model}`);
    logger.info(`User prompt received: "${message}"`);

    const session = await getSession();
    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Simple schema without enum validation - prevents regeneration errors
    const characterSchema = CharacterGenerateSchema.extend({
      tools: z
        .array(z.string())
        .describe("Tools for this character (usually empty for RP characters)")
        .optional()
        .default([]),
    });

    const result = streamObject({
      model: customModelProvider.getModel(chatModel),
      system: CHARACTER_GENERATION_PROMPT,
      prompt: message,
      schema: characterSchema,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    logger.error(error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
