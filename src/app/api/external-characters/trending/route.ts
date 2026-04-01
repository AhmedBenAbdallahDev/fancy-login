/**
 * External Characters API - Trending
 * GET /api/external-characters/trending
 */

import { NextRequest, NextResponse } from "next/server";
import { getTrendingCharacters } from "@/lib/external-characters";
import type { ExternalSourceSlug } from "app-types/external-character";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const source = (searchParams.get("source") || "all") as ExternalSourceSlug;
    const limit = parseInt(searchParams.get("limit") || "20");

    const cards = await getTrendingCharacters(source, limit);

    return NextResponse.json({ cards });
  } catch (error) {
    console.error("[External Characters] Trending error:", error);
    return NextResponse.json(
      { error: "Failed to fetch trending characters" },
      { status: 500 },
    );
  }
}
