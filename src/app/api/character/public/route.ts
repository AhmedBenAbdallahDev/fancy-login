import { characterRepository } from "lib/db/repository";

// GET /api/character/public - Get all public characters
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const sortBy = (searchParams.get("sortBy") as "popular" | "newest" | "name") || "popular";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const creatorUsername = searchParams.get("creatorUsername") || undefined;

    const characters = await characterRepository.findPublic({
      search,
      sortBy,
      limit,
      offset,
      creatorUsername,
    });

    return Response.json(characters);
  } catch (error: any) {
    console.error("Failed to fetch public characters:", error);
    return Response.json(
      { error: error.message || "Failed to fetch public characters" },
      { status: 500 }
    );
  }
}
