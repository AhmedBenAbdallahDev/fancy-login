import { getSession } from "auth/server";
import { characterRepository } from "lib/db/repository";
import { z } from "zod";

const CommentSchema = z.object({
  content: z.string().min(1).max(1000),
});

// GET /api/character/[id]/comments - Get comments for a character
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  try {
    const comments = await characterRepository.getComments(id, limit, offset);
    return Response.json(comments);
  } catch (error: any) {
    console.error("Failed to fetch comments:", error);
    return new Response(error.message || "Failed to fetch comments", {
      status: 500,
    });
  }
}

// POST /api/character/[id]/comments - Add a comment
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  try {
    // Verify character exists and is public
    const character = await characterRepository.findById(id);
    if (!character) {
      return new Response("Character not found", { status: 404 });
    }
    if (!character.isPublic) {
      return new Response("Cannot comment on private characters", {
        status: 403,
      });
    }

    const json = await request.json();
    const { content } = CommentSchema.parse(json);

    const comment = await characterRepository.addComment(
      id,
      session.user.id,
      session.user.name || "Anonymous",
      session.user.image || undefined,
      content,
    );

    return Response.json(comment);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Invalid input", details: error.errors },
        { status: 400 },
      );
    }
    console.error("Failed to add comment:", error);
    return new Response(error.message || "Failed to add comment", {
      status: 500,
    });
  }
}
// DELETE /api/character/[id]/comments - Delete own comment
export async function DELETE(
  request: Request,
  _context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const commentId = searchParams.get("commentId");

  if (!commentId) {
    return new Response("Comment ID required", { status: 400 });
  }

  try {
    await characterRepository.deleteComment(commentId, session.user.id);
    return new Response("OK", { status: 200 });
  } catch (error: any) {
    console.error("Failed to delete comment:", error);
    return new Response(error.message || "Failed to delete comment", {
      status: 500,
    });
  }
}
