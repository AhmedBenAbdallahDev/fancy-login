"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
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
import { Loader2, User } from "lucide-react";

interface ChooseNameModalProps {
  open: boolean;
  onSuccess?: (name: string) => void;
}

/**
 * First modal after signup - asks user for their personal name.
 * This name is used for:
 * - Home greeting ("Good morning, Adam")
 * - AI assistant addressing user in non-persona chats
 * This modal cannot be dismissed - users must complete it.
 */
export function ChooseNameModal({ open, onSuccess }: ChooseNameModalProps) {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 1) {
      toast.error("Please enter your name");
      return;
    }

    if (trimmedName.length > 50) {
      toast.error("Name must be 50 characters or less");
      return;
    }

    setIsSubmitting(true);
    try {
      // Update user.name in the database
      const res = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save name");
      }

      toast.success(`Welcome, ${trimmedName}!`);
      // Small delay to show the toast before reload
      setTimeout(() => {
        onSuccess?.(trimmedName);
      }, 500);
    } catch (error: any) {
      toast.error(error.message || "Failed to save name");
    } finally {
      setIsSubmitting(false);
    }
  }, [name, onSuccess]);

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
            <User className="size-5 text-primary" />
            What should we call you?
          </DialogTitle>
          <DialogDescription>
            Enter your name. This will be used to greet you and when the AI
            assistant talks to you directly.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 mt-4">
          {/* Name Input */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="choose-name">Your Name</Label>
            <Input
              id="choose-name"
              placeholder="e.g. Adam, Sarah, James..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) {
                  handleSubmit();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              This is your personal name, not public. Only you and the AI will
              see it.
            </p>
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !name.trim()}
            className="w-full h-12"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Saving...
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
