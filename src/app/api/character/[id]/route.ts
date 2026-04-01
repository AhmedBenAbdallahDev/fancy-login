import { getSession } from "auth/server";
import {
  characterRepository,
  creatorProfileRepository,
} from "lib/db/repository";
import { CharacterUpdateSchema } from "app-types/character";
import { cookies } from "next/headers";

// Helper to get current user ID (works for both online and offline users)
async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const offlineUserStr = cookieStore.get("diffchat_offline_user")?.value;

  if (offlineUserStr) {
    try {
      const offlineUser = JSON.parse(offlineUserStr);
      return offlineUser.id;
    } catch {
      // Invalid cookie, fall through
    }
  }

  const session = await getSession();
  return session?.user?.id ?? null;
}

// GET /api/character/[id] - Get a specific character
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();
  const { id } = await params;

  try {
    // Try to find as public character first
    let character = await characterRepository.findPublicById(id);

    // If not public and user is logged in, check if it's their character
    if (!character && userId) {
      character = await characterRepository.findByIdForUser(id, userId);
    }

    if (!character) {
      return Response.json({ error: "Character not found" }, { status: 404 });
    }

    return Response.json(character);
  } catch (error: any) {
    console.error("Failed to fetch character:", error);
    return Response.json(
      { error: error.message || "Failed to fetch character" },
      { status: 500 },
    );
  }
}

// PUT /api/character/[id] - Update a character
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();
  const { id } = await params;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const json = await request.json();
    const data = CharacterUpdateSchema.parse(json);

    // Get current character to check if public status is changing
    const currentCharacter = await characterRepository.findByIdForUser(
      id,
      userId,
    );
    if (!currentCharacter) {
      return Response.json({ error: "Character not found" }, { status: 404 });
    }

    // If making public, require creator profile
    const becomingPublic = data.isPublic === true && !currentCharacter.isPublic;
    const stayingPublic = data.isPublic !== false && currentCharacter.isPublic;

    if (becomingPublic || stayingPublic) {
      const creatorProfile =
        await creatorProfileRepository.findByUserId(userId);
      if (!creatorProfile) {
        return Response.json(
          {
            error: "CREATOR_REQUIRED",
            message: "You need a creator profile to publish public characters",
          },
          { status: 400 },
        );
      }
      // Set the creatorUsername from the profile
      data.creatorUsername = creatorProfile.username;
    }

    const character = await characterRepository.update(id, userId, data);

    // Update bot count if public status changed
    if (becomingPublic) {
      await creatorProfileRepository.incrementBotCount(userId);
    } else if (data.isPublic === false && currentCharacter.isPublic) {
      await creatorProfileRepository.decrementBotCount(userId);
    }

    return Response.json(character);
  } catch (error: any) {
    console.error("Failed to update character:", error);
    return Response.json(
      { error: error.message || "Failed to update character" },
      { status: 500 },
    );
  }
}

// DELETE /api/character/[id] - Delete a character
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();
  const { id } = await params;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get character to check if it was public
    const character = await characterRepository.findByIdForUser(id, userId);

    await characterRepository.delete(id, userId);

    // Decrement bot count if it was public
    if (character?.isPublic) {
      await creatorProfileRepository.decrementBotCount(userId);
    }

    return new Response(null, { status: 204 });
  } catch (error: any) {
    console.error("Failed to delete character:", error);
    return Response.json(
      { error: error.message || "Failed to delete character" },
      { status: 500 },
    );
  }
}
