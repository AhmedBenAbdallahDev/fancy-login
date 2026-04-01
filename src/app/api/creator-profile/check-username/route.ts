import { creatorProfileRepository } from "lib/db/repository";

// GET /api/creator-profile/check-username?username=xxx
// Check if a username is available
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username");

    if (!username) {
      return Response.json(
        { error: "Username parameter is required" },
        { status: 400 },
      );
    }

    // Basic validation
    if (username.length < 3) {
      return Response.json({
        available: false,
        reason: "Username must be at least 3 characters",
      });
    }

    if (username.length > 20) {
      return Response.json({
        available: false,
        reason: "Username must be at most 20 characters",
      });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return Response.json({
        available: false,
        reason: "Username can only contain letters, numbers, and underscores",
      });
    }

    const isAvailable =
      await creatorProfileRepository.isUsernameAvailable(username);

    return Response.json({
      available: isAvailable,
      reason: isAvailable ? null : "Username is already taken",
    });
  } catch (error: any) {
    console.error("Failed to check username:", error);
    return Response.json(
      { error: error.message || "Failed to check username" },
      { status: 500 },
    );
  }
}
