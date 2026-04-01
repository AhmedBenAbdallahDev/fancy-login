/**
 * External Characters API - List Sources
 * GET /api/external-characters/sources
 */

import { NextResponse } from "next/server";
import { EXTERNAL_SOURCES } from "app-types/external-character";

export async function GET() {
  return NextResponse.json(EXTERNAL_SOURCES);
}
