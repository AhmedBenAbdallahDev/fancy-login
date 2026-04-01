"use client";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "ui/avatar";
import { Button } from "ui/button";
import { BACKGROUND_COLORS, EMOJI_DATA } from "lib/const";
import { Download, Edit, MessageSquare, Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { fetcher } from "lib/utils";
import { toast } from "sonner";
import { mutate } from "swr";
import Link from "next/link";
import { PublicAgent, BrowseAgent } from "./types";

interface AgentBrowseCardProps {
  agent: BrowseAgent;
  isOwner: boolean;
}

// Format large numbers (e.g., 1500 -> 1.5k)
function formatCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return count.toString();
}

export function AgentBrowseCard({ agent, isOwner }: AgentBrowseCardProps) {
  const t = useTranslations();
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
        toast.success(t("Agent.agentAddedToCollection"));
        mutate("/api/agent");
      } else {
        toast.error(t("Agent.failedToGetAgent"));
      }
    } catch (error) {
      console.error("Error getting agent:", error);
      toast.error(t("Agent.failedToGetAgent"));
    } finally {
      setIsGetting(false);
    }
  };

  const isPublicAgent = !isOwner && "creatorName" in agent;
  const chatCount = (agent as any).chatCount || 0;
  const likeCount = (agent as any).likeCount || 0;

  return (
    <Link href={`/agent/${agent.id}`} className="group block">
      <div className="relative overflow-hidden rounded-xl bg-card border border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1">
        {/* Agent Icon/Avatar - Square aspect ratio */}
        <div
          className="relative aspect-square overflow-hidden flex items-center justify-center"
          style={{
            backgroundColor:
              agent.icon?.style?.backgroundColor || BACKGROUND_COLORS[0],
          }}
        >
          <Avatar className="size-24 sm:size-28">
            <AvatarImage
              src={agent.icon?.value || EMOJI_DATA[0]}
              className="scale-150"
            />
            <AvatarFallback className="bg-transparent text-5xl">
              {agent.name[0]}
            </AvatarFallback>
          </Avatar>

          {/* Gradient overlay at bottom */}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

          {/* Name overlay */}
          <div className="absolute bottom-2 left-3 right-3">
            <h3 className="text-white font-semibold text-base truncate drop-shadow-lg">
              {agent.name}
            </h3>
          </div>

          {/* Edit button for owned agents */}
          {isOwner && (
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="secondary"
                size="icon"
                className="size-8 bg-black/50 hover:bg-black/70 text-white"
                onClick={(e) => e.stopPropagation()}
              >
                <Edit className="size-4" />
              </Button>
            </div>
          )}

          {/* Get button for public agents */}
          {!isOwner && (
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="secondary"
                size="icon"
                className="size-8 bg-black/50 hover:bg-black/70 text-white"
                onClick={handleGetAgent}
                disabled={isGetting}
              >
                <Download className="size-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Info bar */}
        <div className="p-3 space-y-1.5">
          <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
            {(agent as any).tagline || agent.description || "AI Agent"}
          </p>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              {chatCount > 0 && (
                <div className="flex items-center gap-1" title="Chats">
                  <MessageSquare className="size-3.5" />
                  <span>{formatCount(chatCount)}</span>
                </div>
              )}
              {likeCount > 0 && (
                <div className="flex items-center gap-1" title="Likes">
                  <Heart className="size-3.5" />
                  <span>{formatCount(likeCount)}</span>
                </div>
              )}
            </div>
            {isPublicAgent && (
              <span className="truncate max-w-[80px]">
                by {(agent as PublicAgent).creatorName}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
