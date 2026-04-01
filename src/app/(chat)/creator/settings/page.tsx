"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { fetcher } from "lib/utils";
import { CreatorProfile } from "app-types/creator";
import { ScrollArea } from "ui/scroll-area";
import { Button } from "ui/button";
import { Input } from "ui/input";
import { Label } from "ui/label";
import { Textarea } from "ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "ui/avatar";
import { Skeleton } from "ui/skeleton";
import { ImageUpload } from "ui/image-upload";
import {
  ArrowLeft,
  Loader2,
  Save,
  User,
  AtSign,
  FileText,
  Image as ImageIcon,
  Twitter,
  Globe,
  Link as LinkIcon,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

// Discord icon component
function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

export default function CreatorSettingsPage() {
  const router = useRouter();
  const t = useTranslations("CreatorSettings");

  // Fetch current profile
  const { data, isLoading, mutate } = useSWR<{
    hasProfile: boolean;
    profile: CreatorProfile | null;
  }>("/api/creator-profile", fetcher);

  const profile = data?.profile;

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [bannerImage, setBannerImage] = useState("");
  const [twitter, setTwitter] = useState("");
  const [discord, setDiscord] = useState("");
  const [website, setWebsite] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || "");
      setBio(profile.bio || "");
      setAvatar(profile.avatar || "");
      setBannerImage(profile.bannerImage || "");
      setTwitter(profile.socialLinks?.twitter || "");
      setDiscord(profile.socialLinks?.discord || "");
      setWebsite(profile.socialLinks?.website || "");
    }
  }, [profile]);

  const handleSave = useCallback(async () => {
    if (!displayName) {
      toast.error(t("displayNameRequired"));
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/creator-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          bio: bio || undefined,
          avatar: avatar || undefined,
          bannerImage: bannerImage || undefined,
          socialLinks: {
            twitter: twitter || undefined,
            discord: discord || undefined,
            website: website || undefined,
          },
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || t("failedToUpdate"));
      }

      toast.success(t("profileUpdated"));
      mutate();
    } catch (error: any) {
      toast.error(error.message || t("failedToUpdate"));
    } finally {
      setIsSaving(false);
    }
  }, [
    displayName,
    bio,
    avatar,
    bannerImage,
    twitter,
    discord,
    website,
    mutate,
  ]);

  if (isLoading) {
    return (
      <ScrollArea className="h-full w-full">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="space-y-6">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </ScrollArea>
    );
  }

  if (!data?.hasProfile || !profile) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <User className="size-16 text-muted-foreground" />
        <h1 className="text-xl font-semibold">{t("noCreatorProfile")}</h1>
        <p className="text-muted-foreground">{t("needToCreateProfile")}</p>
        <Button onClick={() => router.push("/characters")}>
          {t("goToCharacters")}
        </Button>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full w-full">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href={`/creator/${profile.username}`}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="size-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">{t("title")}</h1>
              <p className="text-sm text-muted-foreground">
                @{profile.username}
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="size-4 animate-spin mr-2" />
            ) : (
              <Save className="size-4 mr-2" />
            )}
            {t("saveChanges")}
          </Button>
        </div>

        <div className="space-y-8">
          {/* Profile Preview */}
          <div className="flex items-center gap-4 p-4 rounded-xl border bg-card">
            <Avatar className="size-16">
              <AvatarImage src={avatar} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-white text-xl">
                {displayName?.[0] || "?"}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{displayName || "Your Name"}</p>
              <p className="text-sm text-muted-foreground">
                @{profile.username}
              </p>
            </div>
            <Link href={`/creator/${profile.username}`} className="ml-auto">
              <Button variant="outline" size="sm">
                {t("viewProfile")}
              </Button>
            </Link>
          </div>

          {/* Basic Info */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <User className="size-5" />
              {t("basicInfo")}
            </h2>

            <div className="space-y-4 p-4 rounded-xl border">
              {/* Username (read-only) */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <AtSign className="size-4" />
                  {t("username")}
                </Label>
                <Input value={profile.username} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">
                  {t("usernameCannotBeChanged")}
                </p>
              </div>

              {/* Display Name */}
              <div className="space-y-2">
                <Label htmlFor="display-name">{t("displayName")}</Label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={50}
                  placeholder={t("displayNamePlaceholder")}
                />
              </div>

              {/* Bio */}
              <div className="space-y-2">
                <Label htmlFor="bio" className="flex items-center gap-1">
                  <FileText className="size-4" />
                  {t("bio")}
                </Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={2000}
                  placeholder={t("bioPlaceholder")}
                  className="min-h-32 max-h-64 resize-none"
                />
                <p className="text-xs text-muted-foreground text-right">
                  {bio.length}/2000
                </p>
              </div>
            </div>
          </div>

          {/* Images */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ImageIcon className="size-5" />
              {t("images")}
            </h2>

            <div className="space-y-6 p-4 rounded-xl border">
              {/* Avatar */}
              <div className="space-y-2">
                <Label>{t("profilePicture")}</Label>
                <div className="max-w-[200px]">
                  <ImageUpload
                    value={avatar}
                    onChange={(url) => setAvatar(url || "")}
                    folder="creators/avatars"
                    maxWidth={400}
                    maxHeight={400}
                    aspectRatio="square"
                    placeholder={t("uploadAvatar")}
                  />
                </div>
              </div>

              {/* Banner */}
              <div className="space-y-2">
                <Label>{t("bannerImage")}</Label>
                <ImageUpload
                  value={bannerImage}
                  onChange={(url) => setBannerImage(url || "")}
                  folder="creators/banners"
                  maxWidth={1500}
                  maxHeight={500}
                  aspectRatio="banner"
                  placeholder={t("uploadBanner")}
                />
              </div>
            </div>
          </div>

          {/* Social Links */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <LinkIcon className="size-5" />
              {t("socialLinks")}
            </h2>

            <div className="space-y-4 p-4 rounded-xl border">
              {/* Twitter */}
              <div className="space-y-2">
                <Label htmlFor="twitter" className="flex items-center gap-1">
                  <Twitter className="size-4" />
                  {t("twitterUsername")}
                </Label>
                <Input
                  id="twitter"
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value.replace("@", ""))}
                  placeholder="username"
                />
              </div>

              {/* Discord */}
              <div className="space-y-2">
                <Label htmlFor="discord" className="flex items-center gap-1">
                  <DiscordIcon className="size-4" />
                  {t("discordInvite")}
                </Label>
                <Input
                  id="discord"
                  value={discord}
                  onChange={(e) => setDiscord(e.target.value)}
                  placeholder="https://discord.gg/..."
                />
              </div>

              {/* Website */}
              <div className="space-y-2">
                <Label htmlFor="website" className="flex items-center gap-1">
                  <Globe className="size-4" />
                  {t("website")}
                </Label>
                <Input
                  id="website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://yourwebsite.com"
                />
              </div>
            </div>
          </div>

          {/* Save button at bottom too */}
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleSave} disabled={isSaving} size="lg">
              {isSaving ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <Save className="size-4 mr-2" />
              )}
              {t("saveChanges")}
            </Button>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
