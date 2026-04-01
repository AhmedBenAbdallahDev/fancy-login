import { getSession } from "auth/server";
import { creatorProfileRepository } from "lib/db/repository";
import {
  CreatorProfileCreateSchema,
  CreatorProfileUpdateSchema,
} from "app-types/creator";
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

// GET /api/creator-profile - Get current user's creator profile
export async function GET() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const profile = await creatorProfileRepository.findByUserId(userId);

    if (!profile) {
      return Response.json({ hasProfile: false, profile: null });
    }

    return Response.json({ hasProfile: true, profile });
  } catch (error: any) {
    console.error("Failed to fetch creator profile:", error);
    return Response.json(
      { error: error.message || "Failed to fetch creator profile" },
      { status: 500 },
    );
  }
}

// POST /api/creator-profile - Create a new creator profile
export async function POST(request: Request) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check if user already has a profile
    const existing = await creatorProfileRepository.findByUserId(userId);
    if (existing) {
      return Response.json(
        { error: "You already have a creator profile" },
        { status: 400 },
      );
    }

    const json = await request.json();
    const data = CreatorProfileCreateSchema.parse(json);

    // Check username availability
    const isAvailable = await creatorProfileRepository.isUsernameAvailable(
      data.username,
    );
    if (!isAvailable) {
      return Response.json(
        { error: "Username is already taken" },
        { status: 400 },
      );
    }

    const profile = await creatorProfileRepository.create(userId, data);
    return Response.json(profile);
  } catch (error: any) {
    console.error("Failed to create creator profile:", error);

    // Handle Zod validation errors
    if (error.name === "ZodError") {
      return Response.json(
        { error: error.errors[0]?.message || "Validation failed" },
        { status: 400 },
      );
    }

    return Response.json(
      { error: error.message || "Failed to create creator profile" },
      { status: 500 },
    );
  }
}

// PUT /api/creator-profile - Update creator profile
export async function PUT(request: Request) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check if user has a profile
    const existing = await creatorProfileRepository.findByUserId(userId);
    if (!existing) {
      return Response.json(
        { error: "You don't have a creator profile yet" },
        { status: 404 },
      );
    }

    const json = await request.json();
    const data = CreatorProfileUpdateSchema.parse(json);

    const profile = await creatorProfileRepository.update(userId, data);
    return Response.json(profile);
  } catch (error: any) {
    console.error("Failed to update creator profile:", error);
    return Response.json(
      { error: error.message || "Failed to update creator profile" },
      { status: 500 },
    );
  }
}
