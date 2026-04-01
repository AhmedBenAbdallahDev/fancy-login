/**
 * External Characters API - Search
 * GET /api/external-characters/search
 */

import { NextRequest, NextResponse } from "next/server";
import {
  searchExternalCharacters,
  filterCards,
} from "@/lib/external-characters";
import type { ExternalSourceSlug } from "app-types/external-character";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const source = (searchParams.get("source") || "all") as ExternalSourceSlug;
    const query = searchParams.get("q") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "40");
    const sort = (searchParams.get("sort") || "popular") as
      | "newest"
      | "popular"
      | "relevance"
      | "trending";
    const tags = searchParams.getAll("tag");
    const excludeTags = searchParams.getAll("excludeTag");
    const nsfw = searchParams.get("nsfw") !== "false";
    const minTokens = searchParams.get("minTokens")
      ? parseInt(searchParams.get("minTokens")!)
      : undefined;
    const maxTokens = searchParams.get("maxTokens")
      ? parseInt(searchParams.get("maxTokens")!)
      : undefined;

    // Get user blocklist from query params (can be stored in localStorage on client)
    const blocklist = searchParams.getAll("blocklist");
    const hideNsfw = searchParams.get("hideNsfw") === "true";

    const results = await searchExternalCharacters({
      source,
      query,
      page,
      limit,
      sort,
      tags,
      excludeTags,
      nsfw,
      minTokens,
      maxTokens,
    });

    // Apply client-side filtering if needed
    if (blocklist.length > 0 || hideNsfw) {
      results.cards = filterCards(results.cards, {
        hideNsfw,
        tagBlocklist: blocklist,
      });
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("[External Characters] Search error:", error);
    return NextResponse.json(
      { error: "Failed to search external characters" },
      { status: 500 },
    );
  }
}
