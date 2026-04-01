"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader, KeyRound, WifiOff, Github } from "lucide-react";
import { toast } from "sonner";
import { offlineGithubLogin } from "@/app/(auth)/actions";
import { useRouter } from "next/navigation";
import { LoadingOverlay } from "@/components/ui/loading-overlay";

interface OfflineLoginDialogProps {
  trigger?: ReactNode;
}

export function OfflineLoginDialog({ trigger }: OfflineLoginDialogProps) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!token) return toast.error("Please enter a token");

    setLoading(true);
    try {
      const result = await offlineGithubLogin(token);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Logged in successfully!");
        setOpen(false);
        router.refresh();
        // Force reload to ensure session is picked up
        window.location.href = "/";
      }
    } catch (_e) {
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <LoadingOverlay
        visible={isRedirecting}
        message="Waiting for GitHub redirect..."
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger ? (
            trigger
          ) : (
            <Button variant="ghost" className="mt-2 w-full gap-2" size="sm">
              <WifiOff className="size-4" />
              Offline / Token Mode
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Offline / Token Login</DialogTitle>
            <DialogDescription>
              Enter a GitHub Personal Access Token (PAT) to log in without the
              browser redirect. This token will be saved locally for Git
              syncing.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Button
              variant="outline"
              className="w-full gap-3"
              onClick={() => {
                setIsRedirecting(true);
                // Small delay to allow fade-in animation before redirect
                setTimeout(() => {
                  window.location.href = "/api/auth/offline-login-redirect";
                }, 200);
              }}
            >
              <Github className="size-4" />
              Connect with GitHub (One-Click)
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or manually enter token
                </span>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="token">GitHub Token</Label>
              <Input
                id="token"
                type="password"
                placeholder="ghp_..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Need a token?{" "}
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo,user:email,read:user&description=DiffChat"
                  target="_blank"
                  rel="noreferrer"
                  className="underline text-primary"
                >
                  Generate one here
                </a>
              </p>
              <Button
                onClick={handleLogin}
                disabled={loading}
                className="w-full gap-2"
              >
                {loading ? (
                  <Loader className="size-4 animate-spin" />
                ) : (
                  <KeyRound className="size-4" />
                )}
                Login
              </Button>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
