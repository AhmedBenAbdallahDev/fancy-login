import { getSession } from "auth/server";
import { chatRepository } from "lib/db/repository";
import { z } from "zod";
import { generateUUID } from "lib/utils";

const CreateThreadSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  characterId: z.string().optional(),
  personaId: z.string().optional(),
  stylePresetId: z.string().optional(),
  greeting: z.string().optional(),
});

export async function GET() {
  const session = await getSession();

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const threads = await chatRepository.selectThreadsByUserId(session.user.id);
  return Response.json(threads);
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const json = await request.json();
    const data = CreateThreadSchema.parse(json);

    const threadId = data.id || generateUUID();

    // Create the thread with character mode fields
    const thread = await chatRepository.insertThread({
      id: threadId,
      title: data.title,
      userId: session.user.id,
      characterId: data.characterId,
      personaId: data.personaId,
      stylePresetId: data.stylePresetId,
    });

    // If there's a greeting, insert it as the first assistant message
    if (data.greeting && data.characterId) {
      await chatRepository.insertMessage({
        id: generateUUID(),
        threadId: thread.id,
        role: "assistant",
        parts: [{ type: "text", text: data.greeting }],
        model: null,
        annotations: [],
      });
    }

    return Response.json(thread);
  } catch (error: any) {
    console.error("Failed to create thread:", error);
    return new Response(error.message || "Failed to create thread", {
      status: 500,
    });
  }
}
