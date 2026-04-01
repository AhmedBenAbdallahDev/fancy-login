"use client";

import { use } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetcher, cn } from "lib/utils";
import { CreatorProfile } from "app-types/creator";
import { CharacterSummary } from "app-types/character";
import { Avatar, AvatarFallback, AvatarImage } from "ui/avatar";
import { Button } from "ui/button";
import { Badge } from "ui/badge";
import { ScrollArea } from "ui/scroll-area";
import { Skeleton } from "ui/skeleton";
import {
  ArrowLeft,
  BadgeCheck,
  Bot,
  Heart,
  Settings,
  Twitter,
  Globe,
  ExternalLink,
  MessageCircle,
} from "lucide-react";

// Discord icon component
function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

// Character card for creator's bots
function CreatorBotCard({ character }: { character: CharacterSummary }) {
  return (
    <Link href={`/character/${character.id}`}>
      <div className="group relative flex flex-col gap-3 p-4 rounded-xl border bg-card hover:bg-accent/50 transition-all hover:shadow-lg hover:-translate-y-1">
        <div className="flex items-start gap-3">
          <Avatar className="size-14 rounded-xl border-2 border-background shadow">
            <AvatarImage src={character.avatar} className="object-cover" />
            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/40 text-lg">
              {character.name[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
              {character.name}
            </h3>
            {character.tagline && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                {character.tagline}
              </p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MessageCircle className="size-3.5" />
            {character.chatCount || 0}
          </span>
          <span className="flex items-center gap-1">
            <Heart className="size-3.5" />
            {character.likeCount || 0}
          </span>
        </div>

        {/* Tags */}
        {character.tags && character.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {character.tags.slice(0, 3).map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-xs px-2 py-0"
              >
                {tag}
              </Badge>
            ))}
            {character.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs px-2 py-0">
                +{character.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function CreatorProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = use(params);
  const router = useRouter();

  // Fetch creator profile
  const {
    data: profile,
    isLoading: profileLoading,
    error: profileError,
  } = useSWR<CreatorProfile>(`/api/creator-profile/${username}`, fetcher);

  // Fetch creator's public characters
  const { data: characters, isLoading: charactersLoading } = useSWR<
    CharacterSummary[]
  >(
    profile ? `/api/character/public?creatorUsername=${username}` : null,
    fetcher,
  );

  // Check if current user owns this profile
  const { data: myProfile } = useSWR<{
    hasProfile: boolean;
    profile: CreatorProfile | null;
  }>("/api/creator-profile", fetcher);
  const isOwner = myProfile?.profile?.username === username;

  if (profileLoading) {
    return (
      <ScrollArea className="h-full w-full">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Skeleton className="h-48 w-full rounded-xl mb-6" />
          <div className="flex gap-6">
            <Skeleton className="size-32 rounded-full" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        </div>
      </ScrollArea>
    );
  }

  if (profileError || !profile) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Bot className="size-16 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Creator not found</h1>
        <p className="text-muted-foreground">@{username} does not exist</p>
        <Button variant="outline" onClick={() => router.push("/characters")}>
          <ArrowLeft className="size-4 mr-2" />
          Back to Characters
        </Button>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full w-full">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back button */}
        <Link
          href="/characters"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="size-4" />
          Back to Characters
        </Link>

        {/* Banner */}
        <div
          className={cn(
            "relative h-48 rounded-xl overflow-hidden mb-6",
            profile.bannerImage
              ? ""
              : "bg-gradient-to-br from-primary/30 via-primary/20 to-background",
          )}
          style={
            profile.bannerImage
              ? {
                  backgroundImage: `url(${profile.bannerImage})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          {/* Owner edit button */}
          {isOwner && (
            <Link href="/creator/settings">
              <Button
                size="sm"
                variant="secondary"
                className="absolute top-4 right-4"
              >
                <Settings className="size-4 mr-2" />
                Edit Profile
              </Button>
            </Link>
          )}
        </div>

        {/* Profile header */}
        <div className="flex flex-col sm:flex-row gap-6 -mt-20 px-4 sm:px-6 relative z-10">
          <Avatar className="size-32 border-4 border-background shadow-xl">
            <AvatarImage src={profile.avatar} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-white text-4xl">
              {profile.displayName[0]}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 pt-4 sm:pt-12">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{profile.displayName}</h1>
              {profile.isVerified && (
                <BadgeCheck className="size-5 text-primary" />
              )}
            </div>
            <p className="text-muted-foreground">@{profile.username}</p>

            {/* Stats */}
            <div className="flex items-center gap-6 mt-3 text-sm">
              <div>
                <span className="font-semibold">{profile.botCount}</span>
                <span className="text-muted-foreground ml-1">bots</span>
              </div>
              <div>
                <span className="font-semibold">{profile.followerCount}</span>
                <span className="text-muted-foreground ml-1">followers</span>
              </div>
            </div>

            {/* Social links */}
            {profile.socialLinks && (
              <div className="flex items-center gap-3 mt-3">
                {profile.socialLinks.twitter && (
                  <a
                    href={`https://twitter.com/${profile.socialLinks.twitter}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Twitter className="size-5" />
                  </a>
                )}
                {profile.socialLinks.discord && (
                  <a
                    href={profile.socialLinks.discord}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <DiscordIcon className="size-5" />
                  </a>
                )}
                {profile.socialLinks.website && (
                  <a
                    href={profile.socialLinks.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <Globe className="size-5" />
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <div className="mt-6 px-4 sm:px-6">
            <p className="text-sm whitespace-pre-wrap">{profile.bio}</p>
          </div>
        )}

        {/* Bots section */}
        <div className="mt-8 px-4 sm:px-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Bot className="size-5" />
            Characters ({profile.botCount})
          </h2>

          {charactersLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          ) : characters && characters.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {characters.map((character) => (
                <CreatorBotCard key={character.id} character={character} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Bot className="size-12 mx-auto mb-3 opacity-50" />
              <p>No public characters yet</p>
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
