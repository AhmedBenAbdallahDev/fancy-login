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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader, Github, Mail, UserPlus, Lock } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "auth/client";
import { useRouter } from "next/navigation";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { UserZodSchema } from "app-types/user";
import { existsByEmailAction } from "@/app/api/auth/actions";

interface AuthModalProps {
  trigger?: ReactNode;
  defaultTab?: "github" | "login" | "signup";
}

export function AuthModal({ trigger, defaultTab = "signup" }: AuthModalProps) {
  const [open, setOpen] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(defaultTab);
  const router = useRouter();

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup form state
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  // Forgot password state
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);

  const githubSignIn = () => {
    if (!process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID) {
      return toast.warning("GitHub OAuth is not configured yet.");
    }
    setIsRedirecting(true);
    authClient.signIn.social({ provider: "github" }).catch((error) => {
      setIsRedirecting(false);
      toast.error(error.error || "GitHub sign-in failed");
    });
  };

  const handleEmailLogin = async () => {
    if (!loginEmail || !loginPassword) {
      return toast.error("Please enter email and password");
    }
    setLoading(true);
    try {
      const result = await authClient.signIn.email({
        email: loginEmail,
        password: loginPassword,
        callbackURL: "/",
      });

      if (result.error) {
        toast.error(result.error.message || "Login failed");
        return;
      }

      toast.success("Logged in successfully!");
      setOpen(false);
      router.push("/");
    } catch (error: any) {
      console.error("Login error:", error);
      toast.error(error?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!loginEmail) {
      return toast.error("Please enter your email first");
    }
    setForgotPasswordLoading(true);
    try {
      const result = await (authClient as any).forgetPassword({
        email: loginEmail,
        redirectTo: "/reset-password",
      });

      if (result.error) {
        toast.error(result.error.message || "Failed to send reset email");
        return;
      }

      toast.success("Password reset email sent! Check your inbox.");
    } catch (error: any) {
      console.error("Forgot password error:", error);
      toast.error(error?.message || "Failed to send reset email");
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  // Generate a random username for new users
  const generateRandomName = () => {
    const adjectives = [
      "Creative",
      "Bright",
      "Swift",
      "Clever",
      "Bold",
      "Brave",
      "Noble",
      "Wise",
    ];
    const nouns = [
      "Creator",
      "Maker",
      "Builder",
      "Artist",
      "Dreamer",
      "Pioneer",
      "Crafter",
    ];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 9999);
    return `${adj}${noun}${num}`;
  };

  const handleEmailSignup = async () => {
    // Validate
    const emailResult = UserZodSchema.shape.email.safeParse(signupEmail);
    if (!emailResult.success) {
      return toast.error("Please enter a valid email");
    }
    const passwordResult =
      UserZodSchema.shape.password.safeParse(signupPassword);
    if (!passwordResult.success) {
      return toast.error("Password must be at least 8 characters");
    }

    setLoading(true);
    try {
      // Check if email exists first
      let emailExists = false;
      try {
        emailExists = await existsByEmailAction(signupEmail);
      } catch (checkError) {
        console.error("Email check error:", checkError);
        // Continue with signup attempt - better-auth will also check
      }

      if (emailExists) {
        toast.error(
          "This email is already registered. Please sign in instead.",
        );
        setActiveTab("login");
        setLoginEmail(signupEmail);
        setLoading(false);
        return;
      }

      // Generate a random name for the user - they'll choose their @username on first login
      const randomName = generateRandomName();

      const result = await authClient.signUp.email({
        email: signupEmail,
        password: signupPassword,
        name: randomName,
      });

      if (result.error) {
        // Check for common error messages
        const errorMsg = result.error.message?.toLowerCase() || "";
        if (
          errorMsg.includes("exist") ||
          errorMsg.includes("already") ||
          errorMsg.includes("duplicate")
        ) {
          toast.error(
            "This email is already registered. Please sign in instead.",
          );
          setActiveTab("login");
          setLoginEmail(signupEmail);
        } else {
          toast.error(result.error.message || "Signup failed");
        }
        return;
      }

      toast.success("Account created! Logging you in...");
      setOpen(false);
      router.push("/");
    } catch (error: any) {
      console.error("Signup error:", error);
      const errorMsg = error?.message?.toLowerCase() || "";
      if (
        errorMsg.includes("exist") ||
        errorMsg.includes("already") ||
        errorMsg.includes("duplicate") ||
        errorMsg.includes("unique")
      ) {
        toast.error(
          "This email is already registered. Please sign in instead.",
        );
        setActiveTab("login");
        setLoginEmail(signupEmail);
      } else if (errorMsg.includes("fetch") || errorMsg.includes("network")) {
        toast.error(
          "Connection error. Please check your internet and try again.",
        );
      } else {
        toast.error(error?.message || "Signup failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <LoadingOverlay
        visible={isRedirecting}
        message="Redirecting to GitHub..."
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger || (
            <Button size="lg" className="h-14 min-w-[220px] gap-2 rounded-full">
              Join Now
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl">
              Welcome to Anvil
            </DialogTitle>
            <DialogDescription className="text-center">
              Join our community of creators
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as any)}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="signup" className="gap-1.5">
                <UserPlus className="size-4" />
                Sign Up
              </TabsTrigger>
              <TabsTrigger value="login" className="gap-1.5">
                <Mail className="size-4" />
                Login
              </TabsTrigger>
              <TabsTrigger value="github" className="gap-1.5">
                <Github className="size-4" />
                GitHub
              </TabsTrigger>
            </TabsList>

            {/* Fixed height container for all tabs */}
            <div className="min-h-[320px] pt-4">
              {/* Signup Tab */}
              <TabsContent value="signup" className="mt-0 space-y-4">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="At least 8 characters"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleEmailSignup()
                      }
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    You&apos;ll choose your unique @username after signing up
                  </p>
                  <Button
                    type="button"
                    onClick={handleEmailSignup}
                    disabled={loading}
                    className="w-full h-12"
                  >
                    {loading ? (
                      <Loader className="size-4 animate-spin" />
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Already have an account?{" "}
                  <button
                    type="button"
                    className="text-primary underline"
                    onClick={() => setActiveTab("login")}
                  >
                    Sign in
                  </button>
                </p>
              </TabsContent>

              {/* Login Tab */}
              <TabsContent value="login" className="mt-0 space-y-4">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleEmailLogin()}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Forgot password?{" "}
                    <button
                      type="button"
                      className="text-primary underline"
                      onClick={handleForgotPassword}
                      disabled={forgotPasswordLoading}
                    >
                      {forgotPasswordLoading ? "Sending..." : "Reset it here"}
                    </button>
                  </p>
                  <Button
                    type="button"
                    onClick={handleEmailLogin}
                    disabled={loading}
                    className="w-full h-12"
                  >
                    {loading ? (
                      <Loader className="size-4 animate-spin" />
                    ) : (
                      "Sign In"
                    )}
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    className="text-primary underline"
                    onClick={() => setActiveTab("signup")}
                  >
                    Sign up
                  </button>
                </p>
              </TabsContent>

              {/* GitHub Tab */}
              <TabsContent value="github" className="mt-0 space-y-4">
                <div className="space-y-4">
                  {/* Main GitHub button */}
                  <Button
                    variant="outline"
                    className="w-full h-14 gap-3 text-base border-2"
                    onClick={githubSignIn}
                    disabled={loading}
                  >
                    <Github className="size-5" />
                    Continue with GitHub
                  </Button>

                  {/* Info box */}
                  <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                    <div className="flex items-start gap-2">
                      <Lock className="size-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          Your data stays private
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Chats and settings are saved to a private repository
                          in your own GitHub account. Only you have access.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Benefits list */}
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-green-500" />
                      <span>Sync across all your devices</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-green-500" />
                      <span>Full ownership of your data</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-green-500" />
                      <span>No account needed on our servers</span>
                    </div>
                  </div>
                </div>

                {/* Spacer to maintain consistent height */}
                <div className="h-4" />
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
