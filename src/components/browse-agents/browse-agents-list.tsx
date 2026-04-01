"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetcher, cn } from "lib/utils";
import { Input } from "ui/input";
import { Button } from "ui/button";
import { BACKGROUND_COLORS, EMOJI_DATA } from "lib/const";
import {
  Search,
  Loader2,
  Plus,
  AlertCircle,
  Wrench,
  Download,
  Cpu,
  Grid3X3,
  Layers,
  LayoutList,
  Sparkles,
  X,
  Filter,
} from "lucide-react";
import { useAgents } from "@/hooks/queries/use-agents";
import { PublicAgent } from "./types";
import { toast } from "sonner";
import { mutate } from "swr";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  MorphingCardStack,
  type CardData,
  type LayoutMode,
} from "ui/morphing-card-stack";

type FilterMode = "all" | "public" | "private";

export function BrowseAgentsList() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [layout, setLayout] = useState<LayoutMode>("grid");

  // Fetch user's own agents
  const {
    data: myAgents,
    isLoading: isLoadingMyAgents,
    error: myAgentsError,
  } = useAgents();

  // Fetch public agents
  const {
    data: publicAgents,
    isLoading: isLoadingPublic,
    error: publicError,
  } = useSWR<PublicAgent[]>("/api/agent/public", fetcher, {
    revalidateOnFocus: false,
  });

  // Combine all agents
  const allAgents = useMemo(() => {
    const myAgentsList = (myAgents || []).map((agent) => ({
      ...agent,
      isOwn: true,
    }));
    const publicAgentsList = (publicAgents || []).map((agent) => ({
      ...agent,
      isOwn: false,
      isPublic: true,
    }));

    // Remove duplicates (own agents that are also public)
    const myAgentIds = new Set(myAgentsList.map((a) => a.id));
    const uniquePublic = publicAgentsList.filter((a) => !myAgentIds.has(a.id));

    return [...myAgentsList, ...uniquePublic];
  }, [myAgents, publicAgents]);

  // Filter agents based on filter mode and search
  const filteredAgents = useMemo(() => {
    let filtered = allAgents;

    // Apply filter
    if (filterMode === "public") {
      // Show all public agents (including user's own public agents)
      filtered = filtered.filter((agent) => agent.isPublic);
    } else if (filterMode === "private") {
      // Show only user's private agents
      filtered = filtered.filter((agent) => agent.isOwn && !agent.isPublic);
    }
    // "all" shows everything

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (agent) =>
          agent.name?.toLowerCase().includes(query) ||
          agent.description?.toLowerCase().includes(query) ||
          agent.tagline?.toLowerCase().includes(query) ||
          (agent as any).creatorName?.toLowerCase().includes(query),
      );
    }

    return filtered;
  }, [allAgents, filterMode, searchQuery]);

  // Featured agents (first 8 public for recommendations)
  const featuredAgents = useMemo(() => {
    return allAgents.filter((a) => a.isPublic && !a.isOwn).slice(0, 8);
  }, [allAgents]);

  // Convert agents to CardData for MorphingCardStack
  const agentCards: CardData[] = useMemo(() => {
    return filteredAgents.map((agent) => ({
      id: agent.id,
      title: agent.name || "Unnamed Agent",
      description:
        agent.tagline ||
        agent.description ||
        "AI Agent with custom capabilities",
      icon: (
        <AgentIcon
          icon={agent.icon?.value}
          bgColor={agent.icon?.style?.backgroundColor}
          name={agent.name}
        />
      ),
      badge: agent.isOwn
        ? agent.isPublic
          ? "Public"
          : "Private"
        : (agent as any).creatorName
          ? `@${(agent as any).creatorName}`
          : undefined,
      onClick: () => router.push(`/agent/${agent.id}`),
    }));
  }, [filteredAgents, router]);

  const isLoading = isLoadingMyAgents || isLoadingPublic;
  const error = myAgentsError || publicError;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="size-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading agents...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <div className="p-4 rounded-full bg-amber-500/10 mb-4">
          <AlertCircle className="size-8 text-amber-500" />
        </div>
        <p className="text-muted-foreground">
          Could not load agents. Please try again.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Featured Section - Mobile Only */}
      {isMobile &&
        featuredAgents.length > 0 &&
        filterMode === "all" &&
        !searchQuery && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <h2 className="text-base font-semibold">Recommended</h2>
              </div>
            </div>
            <MorphingCardStack
              cards={agentCards.filter((c) =>
                featuredAgents.some((f) => f.id === c.id),
              )}
              defaultLayout="stack"
              showLayoutToggle={false}
              className="w-full"
            />
          </div>
        )}

      {/* Controls */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9 h-10 rounded-lg bg-muted/30 border-0"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          <LayoutToggle layout={layout} setLayout={setLayout} />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground" />
          <div className="flex gap-1.5">
            <FilterPill
              active={filterMode === "all"}
              onClick={() => setFilterMode("all")}
              label="All"
              count={allAgents.length}
            />
            <FilterPill
              active={filterMode === "public"}
              onClick={() => setFilterMode("public")}
              label="Public"
              count={allAgents.filter((a) => a.isPublic).length}
            />
            <FilterPill
              active={filterMode === "private"}
              onClick={() => setFilterMode("private")}
              label="Private"
              count={allAgents.filter((a) => a.isOwn && !a.isPublic).length}
            />
          </div>
        </div>

        {/* Create Button */}
        <Link href="/agent/new" className="block">
          <Button className="w-full h-10 rounded-lg gap-2" size="sm">
            <Plus className="size-4" />
            Create New Agent
          </Button>
        </Link>
      </div>

      {/* Agents Display */}
      {filteredAgents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
          <div className="p-6 rounded-full bg-muted/50 mb-6">
            <Cpu className="size-12 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">
            {searchQuery
              ? "No agents found"
              : filterMode === "private"
                ? "No private agents"
                : filterMode === "public"
                  ? "No public agents yet"
                  : "No agents yet"}
          </h3>
          <p className="text-muted-foreground max-w-sm">
            {searchQuery
              ? "Try adjusting your search query"
              : filterMode === "private"
                ? "Create your first private agent"
                : "Create an agent or explore public ones"}
          </p>
        </div>
      ) : (
        <>
          {layout === "stack" ? (
            <MorphingCardStack
              cards={agentCards}
              defaultLayout="stack"
              showLayoutToggle={false}
              className="w-full"
            />
          ) : layout === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredAgents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} isOwner={agent.isOwn} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredAgents.map((agent) => (
                <AgentListCard
                  key={agent.id}
                  agent={agent}
                  isOwner={agent.isOwn}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Agent Icon Component
function AgentIcon({
  icon,
  bgColor,
  name,
}: {
  icon?: string;
  bgColor?: string;
  name?: string;
}) {
  const displayIcon = icon || EMOJI_DATA[0];
  const isEmoji = !displayIcon.startsWith("http");

  return (
    <div
      className="size-10 rounded-lg flex items-center justify-center text-xl overflow-hidden p-2"
      style={{ backgroundColor: bgColor || BACKGROUND_COLORS[0] }}
    >
      {isEmoji ? (
        <span className="select-none">{displayIcon}</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={displayIcon}
          alt={name || "Agent"}
          className="size-full object-cover rounded"
        />
      )}
    </div>
  );
}

// Layout Toggle Component
function LayoutToggle({
  layout,
  setLayout,
}: {
  layout: LayoutMode;
  setLayout: (l: LayoutMode) => void;
}) {
  const layoutIcons = {
    stack: Layers,
    grid: Grid3X3,
    list: LayoutList,
  };

  return (
    <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
      {(Object.keys(layoutIcons) as LayoutMode[]).map((mode) => {
        const Icon = layoutIcons[mode];
        return (
          <button
            key={mode}
            onClick={() => setLayout(mode)}
            className={cn(
              "rounded-md p-1.5 transition-all",
              layout === mode
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary",
            )}
            aria-label={`Switch to ${mode} layout`}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}

// Filter Pill Component
function FilterPill({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1 rounded-full text-xs font-medium transition-all",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label} <span className="opacity-70">({count})</span>
    </button>
  );
}

// Agent Card (Grid View)
function AgentCard({
  agent,
  isOwner = false,
}: {
  agent: any;
  isOwner?: boolean;
}) {
  const [isGetting, setIsGetting] = useState(false);

  const handleGetAgent = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsGetting(true);
    try {
      const response = await fetcher(`/api/agent/copy/${agent.id}`, {
        method: "POST",
      });
      if (response.success) {
        toast.success("Agent added to your collection!");
        mutate("/api/agent");
      }
    } catch (_error) {
      toast.error("Failed to get agent");
    } finally {
      setIsGetting(false);
    }
  };

  const bgColor = agent.icon?.style?.backgroundColor || BACKGROUND_COLORS[0];
  const icon = agent.icon?.value || EMOJI_DATA[0];
  const isEmoji = !icon.startsWith("http");

  return (
    <Link href={`/agent/${agent.id}`} className="group block">
      <div className="relative overflow-hidden rounded-xl bg-card border border-border/40 hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
        <div className="flex p-3 gap-3">
          {/* Icon */}
          <div
            className="relative size-12 shrink-0 rounded-xl flex items-center justify-center shadow-sm overflow-hidden p-2"
            style={{ backgroundColor: bgColor }}
          >
            {isEmoji ? (
              <span className="text-xl select-none">{icon}</span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={icon}
                alt={agent.name || "Agent"}
                className="size-full object-cover rounded"
              />
            )}
          </div>

          {/* Content */}
          <div className="flex flex-col min-w-0 flex-1">
            <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
              {agent.name || "Unnamed Agent"}
            </h3>

            <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
              {agent.tagline ||
                agent.description ||
                "AI Agent with custom capabilities"}
            </p>

            {/* Creator Name */}
            {!isOwner &&
              (agent.creatorName ? (
                <Link
                  href={`/creator/${agent.creatorName}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[10px] text-muted-foreground hover:text-primary transition-colors mt-1"
                >
                  by @{agent.creatorName}
                </Link>
              ) : (
                <span className="text-[10px] text-red-400/60 mt-1">
                  Deleted Creator
                </span>
              ))}

            <div className="mt-auto pt-2 flex items-center justify-between gap-2">
              <div className="flex gap-1">
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-medium">
                  <Wrench className="size-2.5" />
                  Tools
                </span>
              </div>

              {!isOwner && (
                <Button
                  onClick={handleGetAgent}
                  disabled={isGetting}
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs gap-1 hover:bg-primary/10 hover:text-primary"
                >
                  <Download className="size-3" />
                  {isGetting ? "..." : "Get"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Private Badge at Corner */}
        {isOwner && !agent.isPublic && (
          <div className="absolute bottom-2 right-2">
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted/80 backdrop-blur-sm text-muted-foreground border border-border/50">
              Private
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

// Agent List Card (List View)
function AgentListCard({
  agent,
  isOwner = false,
}: {
  agent: any;
  isOwner?: boolean;
}) {
  const [isGetting, setIsGetting] = useState(false);

  const handleGetAgent = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsGetting(true);
    try {
      const response = await fetcher(`/api/agent/copy/${agent.id}`, {
        method: "POST",
      });
      if (response.success) {
        toast.success("Agent added to your collection!");
        mutate("/api/agent");
      }
    } catch (_error) {
      toast.error("Failed to get agent");
    } finally {
      setIsGetting(false);
    }
  };

  const bgColor = agent.icon?.style?.backgroundColor || BACKGROUND_COLORS[0];
  const icon = agent.icon?.value || EMOJI_DATA[0];
  const isEmoji = !icon.startsWith("http");

  return (
    <Link href={`/agent/${agent.id}`} className="group block">
      <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/40 hover:border-primary/40 transition-all duration-300 hover:shadow-md">
        {/* Icon */}
        <div
          className="relative size-10 shrink-0 rounded-lg flex items-center justify-center overflow-hidden p-2"
          style={{ backgroundColor: bgColor }}
        >
          {isEmoji ? (
            <span className="text-xl select-none">{icon}</span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={icon}
              alt={agent.name || "Agent"}
              className="size-full object-cover rounded"
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
              {agent.name}
            </h3>
            {isOwner && !agent.isPublic && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border">
                Private
              </span>
            )}
            {!isOwner &&
              (agent.creatorName ? (
                <Link
                  href={`/creator/${agent.creatorName}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
                >
                  @{agent.creatorName}
                </Link>
              ) : (
                <span className="text-[10px] text-red-400/60">
                  Deleted Creator
                </span>
              ))}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {agent.tagline ||
              agent.description ||
              "AI Agent with custom capabilities"}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-medium">
            <Wrench className="size-2.5" />
            Tools
          </span>
          {!isOwner && (
            <Button
              onClick={handleGetAgent}
              disabled={isGetting}
              variant="outline"
              size="sm"
              className="h-7 px-3 text-xs gap-1"
            >
              <Download className="size-3" />
              {isGetting ? "..." : "Get"}
            </Button>
          )}
        </div>
      </div>
    </Link>
  );
}
