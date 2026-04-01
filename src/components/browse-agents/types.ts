import { Agent } from "app-types/agent";

// Type for public agents returned from API with creator information
export type PublicAgent = Omit<Agent, "instructions"> & {
  creatorName?: string;
};

// Type for user's own agents (same as what useAgents returns)
export type MyAgent = Omit<Agent, "instructions">;

// Union type for browse card component
export type BrowseAgent = PublicAgent | MyAgent;
