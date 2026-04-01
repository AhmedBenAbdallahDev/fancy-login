/**
 * GitHub Database Onboarding Modal
 *
 * This modal appears when hasGitKey=false and guides users through
 * setting up their personal GitHub database repository.
 */

"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Github,
  AlertTriangle,
} from "lucide-react";
import { useGitHubSetupStatus } from "@/lib/github-setup-status";
import {
  initializeDiffDBAction,
  validateGitHubRepoAction,
} from "@/lib/diffdb/actions";

interface GitHubOnboardingModalProps {
  userId: string;
  onComplete?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

type SetupStep =
  | "verifying-permissions"
  | "validating-setup"
  | "completed"
  | "error";

const SETUP_STEPS = [
  {
    key: "verifying-permissions",
    label: "Verifying GitHub permissions",
    description: "Checking your GitHub repository access...",
  },
  {
    key: "validating-setup",
    label: "Validating repository",
    description: "Verifying database structure...",
  },
  {
    key: "completed",
    label: "Setup completed!",
    description: "Your GitHub database is ready to use!",
  },
];

export function GitHubOnboardingModal({
  userId,
  onComplete,
  onError,
  className,
}: GitHubOnboardingModalProps) {
  const { status, markAsCompleted, markAsIncomplete } =
    useGitHubSetupStatus(userId);
  const [currentStep, setCurrentStep] = useState<SetupStep>(
    "verifying-permissions",
  );
  const [error, setError] = useState<string>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [repositoryUrl, setRepositoryUrl] = useState<string>();
  const [retryCount, setRetryCount] = useState(0);
  const [isVisible, setIsVisible] = useState(true); // Local state for immediate control

  // Show modal if user needs onboarding AND not manually closed
  const shouldShow = isVisible && (!status.hasGitKey || !status.setupCompleted);

  /**
   * Main setup process
   */
  const runSetup = async () => {
    setIsProcessing(true);
    setError(undefined);
    setRetryCount((prev) => prev + 1);

    try {
      // Step 1: Verify authentication and permissions
      setCurrentStep("verifying-permissions");
      const initResult = await initializeDiffDBAction();

      if (!initResult.success) {
        throw new Error(
          initResult.error || "Failed to initialize GitHub database",
        );
      }

      // Step 2: Validate repository structure
      setCurrentStep("validating-setup");
      const validateResult = await validateGitHubRepoAction();

      if (!validateResult.success) {
        throw new Error(validateResult.error || "Repository validation failed");
      }

      // Success!
      setCurrentStep("completed");
      setRepositoryUrl(initResult.data?.repository?.html_url);

      // Mark as completed in local storage
      const repoName = initResult.data?.repository?.name || "diffchat-data";
      markAsCompleted(repoName);

      // Close modal immediately and notify parent
      setIsVisible(false); // Hide modal first
      onComplete?.(); // Then notify parent
    } catch (err: any) {
      setCurrentStep("error");
      const errorMessage = err.message || "Setup failed";
      setError(errorMessage);
      onError?.(errorMessage);
      markAsIncomplete();
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Start setup when modal opens
   */
  useEffect(() => {
    if (
      shouldShow &&
      !isProcessing &&
      currentStep === "verifying-permissions"
    ) {
      // Start immediately, no delays
      runSetup();
    }
  }, [shouldShow]);

  /**
   * Get current step info
   */
  const getCurrentStepInfo = () => {
    return (
      SETUP_STEPS.find((step) => step.key === currentStep) || SETUP_STEPS[0]
    );
  };

  const currentStepInfo = getCurrentStepInfo();
  const currentStepIndex = SETUP_STEPS.findIndex(
    (step) => step.key === currentStep,
  );
  const progressPercentage =
    currentStep === "error"
      ? 0
      : ((currentStepIndex + 1) / SETUP_STEPS.length) * 100;

  if (!shouldShow) {
    return null;
  }

  return (
    <Dialog open={shouldShow} onOpenChange={() => {}}>
      <DialogContent
        className={`sm:max-w-md ${className}`}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center mb-4">
            {currentStep === "error" ? (
              <XCircle className="w-8 h-8 text-primary-foreground" />
            ) : currentStep === "completed" ? (
              <CheckCircle className="w-8 h-8 text-primary-foreground" />
            ) : (
              <Github className="w-8 h-8 text-primary-foreground" />
            )}
          </div>

          <DialogTitle className="text-xl">
            {currentStep === "error"
              ? "Setup Failed"
              : currentStep === "completed"
                ? "GitHub Database Ready!"
                : "Setting Up Your Personal Database"}
          </DialogTitle>

          <DialogDescription className="text-base">
            {currentStep === "error"
              ? "There was an error setting up your GitHub database."
              : currentStep === "completed"
                ? "Your secure, personal database is ready to use!"
                : "Creating your private GitHub repository for data storage..."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Section */}
          {currentStep !== "error" && currentStep !== "completed" && (
            <div className="space-y-4">
              {/* Progress Bar */}
              <div className="space-y-2">
                <Progress value={progressPercentage} className="w-full h-3" />
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    Step {currentStepIndex + 1} of {SETUP_STEPS.length}
                  </span>
                  <span>{Math.round(progressPercentage)}%</span>
                </div>
              </div>

              {/* Current Step */}
              <div className="bg-accent rounded-lg p-4 border border-border">
                <div className="flex items-center space-x-3">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <div>
                    <p className="font-medium text-accent-foreground">
                      {currentStepInfo.label}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {currentStepInfo.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Success State */}
          {currentStep === "completed" && (
            <div className="text-center space-y-4">
              <div className="bg-accent rounded-lg p-6 border border-border">
                <CheckCircle className="w-12 h-12 text-primary mx-auto mb-4" />
                <h3 className="font-semibold text-accent-foreground mb-2">
                  🎉 Database Created Successfully!
                </h3>
                <div className="text-sm text-muted-foreground space-y-2">
                  {repositoryUrl && (
                    <p>
                      <strong>Repository:</strong>{" "}
                      <a
                        href={repositoryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:no-underline"
                      >
                        View on GitHub ↗
                      </a>
                    </p>
                  )}
                  <p>✅ Database structure initialized</p>
                  <p>✅ Ready for chat data storage</p>
                  <p>🔒 Private repository - only you have access</p>
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {currentStep === "error" && (
            <div className="space-y-4">
              <div className="bg-destructive/10 rounded-lg p-4 border border-destructive/20">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-destructive-foreground mb-1">
                      Setup Failed
                    </p>
                    <p className="text-sm text-muted-foreground">{error}</p>
                    {retryCount > 1 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Attempt {retryCount} of 3
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex space-x-2">
                <Button
                  onClick={runSetup}
                  disabled={isProcessing || retryCount >= 3}
                  className="flex-1"
                  variant="default"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Retrying...
                    </>
                  ) : retryCount >= 3 ? (
                    "Max retries reached"
                  ) : (
                    `Try Again (${retryCount}/3)`
                  )}
                </Button>
              </div>

              {retryCount >= 3 && (
                <div className="text-center text-sm text-muted-foreground">
                  <p>
                    Please check your GitHub authentication and try again later.
                  </p>
                  <p className="mt-1">
                    <a href="/sign-in" className="underline hover:no-underline">
                      Re-authenticate with GitHub
                    </a>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Info Text */}
          {currentStep !== "error" && (
            <div className="text-xs text-center text-muted-foreground border-t pt-4 space-y-1">
              <p>🔒 Your data is stored privately in your GitHub account</p>
              <p>📝 Every change is tracked with Git version control</p>
              <p>🚀 No vendor lock-in - you own your data completely</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
