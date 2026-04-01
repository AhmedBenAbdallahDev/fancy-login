import { getSession } from "auth/server";
import {
  characterRepository,
  creatorProfileRepository,
} from "lib/db/repository";
import { CharacterCreateSchema } from "app-types/character";
import { cookies } from "next/headers";

// Helper to get current user ID (works for both online and offline users)
async function getCurrentUserId(): Promise<string | null> {
  // Check for offline user first
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

  // Check for online session
  const session = await getSession();
  return session?.user?.id ?? null;
}

// GET /api/character - Get user's characters
export async function GET() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const characters = await characterRepository.findByUserId(userId);
    return Response.json(characters);
  } catch (error: any) {
    console.error("Failed to fetch characters:", error);
    return Response.json(
      { error: error.message || "Failed to fetch characters" },
      { status: 500 },
    );
  }
}

// POST /api/character - Create a new character
export async function POST(request: Request) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const json = await request.json();
    const data = CharacterCreateSchema.parse(json);

    // If character is public, require creator profile and set creatorUsername
    if (data.isPublic) {
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

    const character = await characterRepository.create(userId, data);

    // Increment creator's bot count if public
    if (data.isPublic) {
      await creatorProfileRepository.incrementBotCount(userId);
    }

    return Response.json(character);
  } catch (error: any) {
    console.error("Failed to create character:", error);
    // Return JSON error response instead of plain text
    return Response.json(
      { error: error.message || "Failed to create character" },
      { status: 500 },
    );
  }
}
