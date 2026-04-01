"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "lib/utils";
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
import { Loader2, CheckCircle2, XCircle, AtSign, Theater } from "lucide-react";

interface ChooseUsernameModalProps {
  open: boolean;
  onSuccess?: (profile: CreatorProfile) => void;
}

/**
 * A required modal that appears on first login.
 * Users MUST choose their unique @username before using the app.
 * This modal cannot be dismissed - users must complete the form.
 */
export function ChooseUsernameModal({
  open,
  onSuccess,
}: ChooseUsernameModalProps) {
  const [username, setUsername] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");
  const [usernameError, setUsernameError] = useState<string | null>(null);

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
    if (!username || usernameStatus !== "available") {
      toast.error("Please choose a valid username");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/creator-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.toLowerCase(),
          // Display name defaults to the username for now - they can change it later
          displayName: username,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create profile");
      }

      const profile = await res.json();
      toast.success("Welcome! Your username is @" + profile.username);
      onSuccess?.(profile);
    } catch (error: any) {
      toast.error(error.message || "Failed to set username");
    } finally {
      setIsSubmitting(false);
    }
  }, [username, usernameStatus, onSuccess]);

  return (
    <Dialog
      open={open}
      onOpenChange={() => {
        /* Cannot close - required */
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideClose
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Theater className="size-5 text-primary" />
            Choose Your Username
          </DialogTitle>
          <DialogDescription>
            Pick a unique username that will identify you on the platform. This
            is how others will find and mention you.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 mt-4">
          {/* Username */}
          <div className="flex flex-col gap-2">
            <Label
              htmlFor="choose-username"
              className="flex items-center gap-1"
            >
              <AtSign className="size-4" />
              Username
            </Label>
            <div className="relative">
              <Input
                id="choose-username"
                placeholder="your_username"
                value={username}
                onChange={(e) =>
                  setUsername(
                    e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                  )
                }
                maxLength={20}
                autoFocus
                className={cn(
                  "pr-10",
                  usernameStatus === "available" &&
                    "border-green-500 focus-visible:ring-green-500",
                  usernameStatus === "taken" &&
                    "border-destructive focus-visible:ring-destructive",
                )}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && usernameStatus === "available") {
                    handleSubmit();
                  }
                }}
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
                <span className="text-green-600">Username is available!</span>
              ) : (
                "3-20 characters, lowercase letters, numbers, and underscores"
              )}
            </p>
          </div>

          {/* Info note */}
          <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
            💡 You can edit your display name and profile later in settings.
            Your username cannot be changed once set.
          </p>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={
              isSubmitting || !username || usernameStatus !== "available"
            }
            className="w-full h-12"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Creating...
              </>
            ) : (
              "Continue"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
