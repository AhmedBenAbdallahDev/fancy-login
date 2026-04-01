import { getSession } from "auth/server";
import { personaRepository } from "lib/db/repository";
import { PersonaUpdateSchema } from "app-types/persona";
import { NextResponse } from "next/server";

// GET /api/persona/[id] - Get a specific persona
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
    const persona = await personaRepository.findById(id, session.user.id);

    if (!persona) {
      return NextResponse.json({ error: "Persona not found" }, { status: 404 });
    }

    return NextResponse.json(persona);
  } catch (error: any) {
    console.error("Failed to get persona:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get persona" },
      { status: 500 },
    );
  }
}

// PUT /api/persona/[id] - Update a persona
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
    const data = PersonaUpdateSchema.parse(json);

    const persona = await personaRepository.update(id, session.user.id, data);
    return NextResponse.json(persona);
  } catch (error: any) {
    console.error("Failed to update persona:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update persona" },
      { status: 500 },
    );
  }
}

// DELETE /api/persona/[id] - Delete a persona
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
    await personaRepository.delete(id, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete persona:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete persona" },
      { status: 500 },
    );
  }
}
