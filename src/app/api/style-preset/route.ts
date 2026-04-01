import { getSession } from "auth/server";
import { stylePresetRepository } from "lib/db/repository";
import {
  StylePresetCreateSchema,
  DEFAULT_STYLE_PRESETS,
} from "app-types/style-preset";
import { NextResponse } from "next/server";

// GET /api/style-preset - Get all style presets for current user
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const presets = await stylePresetRepository.findByUserId(session.user.id);

    // If user has no presets, return default templates (not saved yet)
    if (presets.length === 0) {
      return NextResponse.json({
        presets: [],
        templates: DEFAULT_STYLE_PRESETS,
      });
    }

    return NextResponse.json({ presets, templates: DEFAULT_STYLE_PRESETS });
  } catch (error: any) {
    console.error("Failed to get style presets:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get style presets" },
      { status: 500 },
    );
  }
}

// POST /api/style-preset - Create a new style preset
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await request.json();
    const data = StylePresetCreateSchema.parse(json);

    const preset = await stylePresetRepository.create(session.user.id, data);

    return NextResponse.json(preset);
  } catch (error: any) {
    console.error("Failed to create style preset:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create style preset" },
      { status: 500 },
    );
  }
}
