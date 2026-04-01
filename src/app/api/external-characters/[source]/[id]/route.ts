/**
 * External Characters API - Get Character Details
 * GET /api/external-characters/[source]/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { getExternalCharacter } from "@/lib/external-characters";
import type { ExternalSourceSlug } from "app-types/external-character";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ source: string; id: string }> },
) {
  try {
    const { source, id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const slug = searchParams.get("slug") || undefined;

    const card = await getExternalCharacter(
      source as ExternalSourceSlug,
      decodeURIComponent(id),
      { slug },
    );

    return NextResponse.json(card);
  } catch (error) {
    console.error("[External Characters] Get character error:", error);
    return NextResponse.json(
      { error: "Failed to fetch character details" },
      { status: 500 },
    );
  }
}
