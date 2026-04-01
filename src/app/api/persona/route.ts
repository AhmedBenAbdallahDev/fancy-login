import { getSession } from "auth/server";
import { personaRepository } from "lib/db/repository";
import { PersonaCreateSchema } from "app-types/persona";
import { NextResponse } from "next/server";

// GET /api/persona - Get all personas for current user
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const personas = await personaRepository.findByUserId(session.user.id);
    return NextResponse.json(personas);
  } catch (error: any) {
    console.error("Failed to get personas:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get personas" },
      { status: 500 },
    );
  }
}

// POST /api/persona - Create a new persona
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await request.json();
    const data = PersonaCreateSchema.parse(json);

    const persona = await personaRepository.create(session.user.id, data);
    return NextResponse.json(persona);
  } catch (error: any) {
    console.error("Failed to create persona:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create persona" },
      { status: 500 },
    );
  }
}
