import { getSession } from "auth/server";
import { characterRepository } from "lib/db/repository";

// POST /api/character/[id]/like - Toggle like on a character
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  const { id } = await params;

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const isLiked = await characterRepository.isLikedByUser(
      id,
      session.user.id,
    );

    if (isLiked) {
      await characterRepository.unlike(id, session.user.id);
    } else {
      await characterRepository.like(id, session.user.id);
    }

    // Get updated like status
    const character = await characterRepository.findById(id);

    return Response.json({
      liked: !isLiked,
      likeCount: character?.likeCount || 0,
    });
  } catch (error: any) {
    console.error("Failed to toggle like:", error);
    return new Response(error.message || "Failed to toggle like", {
      status: 500,
    });
  }
}

// GET /api/character/[id]/like - Check if user has liked
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  const { id } = await params;

  if (!session?.user?.id) {
    return Response.json({ liked: false });
  }

  try {
    const isLiked = await characterRepository.isLikedByUser(
      id,
      session.user.id,
    );
    return Response.json({ liked: isLiked });
  } catch (error: any) {
    console.error("Failed to check like status:", error);
    return new Response(error.message || "Failed to check like status", {
      status: 500,
    });
  }
}
