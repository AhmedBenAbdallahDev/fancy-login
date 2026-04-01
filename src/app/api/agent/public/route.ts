import { agentRepository } from "lib/db/repository";

export async function GET() {
  try {
    const publicAgents = await agentRepository.selectPublicAgents();
    // Filter out any corrupted/incomplete data
    const validAgents = (publicAgents || []).filter((agent) => agent && agent.id);
    return Response.json(validAgents);
  } catch (error) {
    console.error("Failed to fetch public agents:", error);
    // Return empty array instead of error - more graceful handling
    return Response.json([]);
  }
}
