import { creatorProfileRepository } from "lib/db/repository";

// GET /api/creator-profile/[username] - Get creator profile by username
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;

  if (!username) {
    return Response.json({ error: "Username is required" }, { status: 400 });
  }

  try {
    const profile = await creatorProfileRepository.findByUsername(username);

    if (!profile) {
      return Response.json({ error: "Creator not found" }, { status: 404 });
    }

    return Response.json(profile);
  } catch (error: any) {
    console.error("Failed to fetch creator profile:", error);
    return Response.json(
      { error: error.message || "Failed to fetch creator profile" },
      { status: 500 },
    );
  }
}
