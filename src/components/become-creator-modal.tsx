"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { fetcher, cn } from "lib/utils";
import { CreatorProfile } from "app-types/creator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "ui/dialog";
import { Button } from "ui/button";
import { Input } from "ui/input";
import { Label } from "ui/label";
import { Textarea } from "ui/textarea";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AtSign,
  Sparkles,
  User,
} from "lucide-react";

interface BecomeCreatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (profile: CreatorProfile) => void;
}

export function BecomeCreatorModal({
  open,
  onOpenChange,
  onSuccess,
}: BecomeCreatorModalProps) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");
  const [usernameError, setUsernameError] = useState<string | null>(null);

  // Check if user already has a creator profile
  const { data: existingProfile, mutate: mutateProfile } = useSWR<{
    hasProfile: boolean;
    profile: CreatorProfile | null;
  }>(open ? "/api/creator-profile" : null, fetcher);

  // Debounced username availability check
  useEffect(() => {
    if (!username || username.length < 3) {
      setUsernameStatus("idle");
      setUsernameError(null);
      return;
    }

    // Validate format
    const usernameRegex = /^[a-z0-9_]{3,20}$/;
    if (!usernameRegex.test(username.toLowerCase())) {
      setUsernameStatus("idle");
      setUsernameError(
        "Only lowercase letters, numbers, and underscores allowed",
      );
      return;
    }

    setUsernameError(null);
    setUsernameStatus("checking");

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/creator-profile/check-username?username=${encodeURIComponent(username)}`,
        );
        const data = await res.json();
        setUsernameStatus(data.available ? "available" : "taken");
      } catch {
        setUsernameStatus("idle");
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username]);

  const handleSubmit = useCallback(async () => {
    if (!username || !displayName || usernameStatus !== "available") {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/creator-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.toLowerCase(),
          displayName,
          bio: bio || undefined,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create profile");
      }

      const profile = await res.json();
      toast.success("🎉 You're now a creator!");
      mutateProfile();
      onSuccess?.(profile);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to create creator profile");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    username,
    displayName,
    bio,
    usernameStatus,
    mutateProfile,
    onSuccess,
    onOpenChange,
  ]);

  // If user already has a profile, show a different message
  if (existingProfile?.hasProfile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-green-500" />
              You are already a creator
            </DialogTitle>
            <DialogDescription>
              Your creator username is @{existingProfile.profile?.username}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              variant="outline"
              onClick={() => (window.location.href = `/creator/settings`)}
            >
              Edit Profile
            </Button>
            <Button
              onClick={() =>
                (window.location.href = `/creator/${existingProfile.profile?.username}`)
              }
            >
              View Profile
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="size-5 text-primary" />
            Become a Creator
          </DialogTitle>
          <DialogDescription>
            Create your public creator profile to publish bots, get recognized,
            and build your community.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 mt-4">
          {/* Username */}
          <div className="flex flex-col gap-2">
            <Label
              htmlFor="creator-username"
              className="flex items-center gap-1"
            >
              <AtSign className="size-4" />
              Username
              <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="creator-username"
                placeholder="your_username"
                value={username}
                onChange={(e) =>
                  setUsername(
                    e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                  )
                }
                maxLength={20}
                className={cn(
                  "pr-10",
                  usernameStatus === "available" &&
                    "border-green-500 focus-visible:ring-green-500",
                  usernameStatus === "taken" &&
                    "border-destructive focus-visible:ring-destructive",
                )}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {usernameStatus === "checking" && (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                )}
                {usernameStatus === "available" && (
                  <CheckCircle2 className="size-4 text-green-500" />
                )}
                {usernameStatus === "taken" && (
                  <XCircle className="size-4 text-destructive" />
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {usernameError ? (
                <span className="text-destructive">{usernameError}</span>
              ) : usernameStatus === "taken" ? (
                <span className="text-destructive">
                  This username is already taken
                </span>
              ) : usernameStatus === "available" ? (
                <span className="text-green-600">Username is available</span>
              ) : (
                "3-20 characters, lowercase letters, numbers, and underscores only"
              )}
            </p>
          </div>

          {/* Display Name */}
          <div className="flex flex-col gap-2">
            <Label
              htmlFor="creator-display-name"
              className="flex items-center gap-1"
            >
              <User className="size-4" />
              Display Name
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="creator-display-name"
              placeholder="Your Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground">
              This is how your name will appear on your bots and profile
            </p>
          </div>

          {/* Bio */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="creator-bio">Bio (optional)</Label>
            <Textarea
              id="creator-bio"
              placeholder="Tell people about yourself... What kind of bots do you create? What inspires you?"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={2000}
              className="min-h-24 max-h-48 resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {bio.length}/2000
            </p>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                isSubmitting ||
                !username ||
                !displayName ||
                usernameStatus !== "available"
              }
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="size-4 mr-2" />
                  Create Profile
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
