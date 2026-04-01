import { getSession } from "auth/server";
import { stylePresetRepository } from "lib/db/repository";
import { StylePresetUpdateSchema } from "app-types/style-preset";
import { NextResponse } from "next/server";

// GET /api/style-preset/[id] - Get a specific style preset
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const preset = await stylePresetRepository.findById(id, session.user.id);

    if (!preset) {
      return NextResponse.json(
        { error: "Style preset not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(preset);
  } catch (error: any) {
    console.error("Failed to get style preset:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get style preset" },
      { status: 500 },
    );
  }
}

// PUT /api/style-preset/[id] - Update a style preset
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const json = await request.json();
    const data = StylePresetUpdateSchema.parse(json);

    const preset = await stylePresetRepository.update(
      id,
      session.user.id,
      data,
    );

    return NextResponse.json(preset);
  } catch (error: any) {
    console.error("Failed to update style preset:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update style preset" },
      { status: 500 },
    );
  }
}

// DELETE /api/style-preset/[id] - Delete a style preset
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await stylePresetRepository.delete(id, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete style preset:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete style preset" },
      { status: 500 },
    );
  }
}
