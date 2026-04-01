import { getSession } from "auth/server";
import { chatRepository } from "lib/db/repository";
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

// GET /api/character/[id]/threads - Get all threads for a character
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();
  const { id } = await params;

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const threads = await chatRepository.selectThreadsByCharacterId(id, userId);
    return Response.json(threads);
  } catch (error: any) {
    console.error("Failed to fetch character threads:", error);
    return Response.json(
      { error: error.message || "Failed to fetch threads" },
      { status: 500 },
    );
  }
}