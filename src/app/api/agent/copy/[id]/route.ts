import { agentRepository } from "lib/db/repository";
import { getSession } from "auth/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();

  if (!session?.user.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { id } = await params;

    // Get the public agent
    const publicAgent = await agentRepository.selectPublicAgentById(id);

    if (!publicAgent) {
      return Response.json(
        { error: "Agent not found or not public" },
        { status: 404 },
      );
    }

    // Create a copy for the current user (private by default)
    const copiedAgent = await agentRepository.insertAgent({
      name: publicAgent.name,
      description: publicAgent.description,
      icon: publicAgent.icon,
      userId: session.user.id,
      isPublic: false, // Copies are private by default
      instructions: publicAgent.instructions,
    });

    return Response.json({
      success: true,
      agent: copiedAgent,
      message: "Agent copied successfully",
    });
  } catch (error) {
    console.error("Failed to copy agent:", error);
    return Response.json({ error: "Failed to copy agent" }, { status: 500 });
  }
}
