"use client";

import { memo, useMemo } from "react";
import { UIMessage } from "ai";
import { cn } from "lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";
import { FileText, Gauge, AlertTriangle, Zap } from "lucide-react";
import useSWR from "swr";
import { UserPreferences } from "app-types/user";
import { fetcher } from "lib/utils";
import { ChatModel } from "app-types/chat";

// Constants matching backend (src/app/api/chat/route.ts)
const DEFAULT_MAX_CONTEXT = 60000; // Default context limit
const SUMMARY_TRIGGER_THRESHOLD = 0.8; // 80% triggers summarization

// Token estimation - more accurate than simple char/4
// Accounts for JSON overhead, tool invocations, etc.
function estimateTokens(text: string): number {
  if (!text) return 0;
  // ~4 chars per token for English, but add overhead for structure
  return Math.ceil(text.length / 3.5);
}

interface TokenBreakdown {
  /** Total tokens in all messages shown in UI */
  totalInUI: number;
  /** Tokens in summary message (if any) */
  summaryTokens: number;
  /** Tokens in regular conversation messages (excluding summary) */
  conversationTokens: number;
  /** Estimated tokens actually sent to LLM */
  estimatedContextSent: number;
  /** Whether there's an active summary */
  hasSummary: boolean;
  /** Number of messages summarized */
  summarizedCount: number;
  /** Number of messages in conversation */
  messageCount: number;
  /** Index of summary message in the array */
  summaryIdx: number;
}

function analyzeMessages(
  messages: UIMessage[],
  autoSummary: boolean = true,
): TokenBreakdown {
  let totalInUI = 0;
  let summaryTokens = 0;
  let conversationTokens = 0;
  let hasSummary = false;
  let summarizedCount = 0;
  let messageCount = 0;

  let summaryIdx = -1;
  const messageTokenWeights: number[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const annotations = msg.annotations as any[] | undefined;
    const isSummary = annotations?.some((a) => a.isSummaryBadge) ?? false;

    const content =
      msg.parts
        ?.map((p) => {
          if (p.type === "text") return p.text;
          if (p.type === "tool-invocation") return JSON.stringify(p);
          if (p.type === "reasoning") return (p as any).reasoning || "";
          return "";
        })
        .join("") ?? "";

    const tokens = estimateTokens(content);
    totalInUI += tokens;

    if (isSummary) {
      summaryTokens = tokens;
      hasSummary = true;
      summaryIdx = i;
      const summaryAnnotation = annotations?.find((a) => a.isSummaryBadge);
      summarizedCount = summaryAnnotation?.summarizedCount ?? 0;
    } else {
      conversationTokens += tokens;
      messageCount++;
    }
    messageTokenWeights.push(tokens);
  }

  // Estimate what's actually sent to LLM:
  // - If summary exists and autoSummary is ON: Summary message + everything AFTER it
  // - Otherwise: Everything (the backend will trim if it exceeds hard limits)
  let estimatedContextSent: number;

  if (hasSummary && autoSummary && summaryIdx !== -1) {
    estimatedContextSent = 0;
    for (let i = summaryIdx; i < messages.length; i++) {
      estimatedContextSent += messageTokenWeights[i];
    }
  } else {
    estimatedContextSent = totalInUI;
  }

  return {
    totalInUI,
    summaryTokens,
    conversationTokens,
    estimatedContextSent,
    hasSummary: hasSummary && autoSummary, // Only consider effective summary if enabled
    summarizedCount,
    messageCount,
    summaryIdx,
  };
}

interface TokenCounterProps {
  messages: UIMessage[];
  chatModel?: ChatModel;
  className?: string;
  threadId?: string;
}

import { appStore } from "@/app/store";
import { useShallow } from "zustand/shallow";

function PureTokenCounter({
  messages,
  chatModel,
  className,
  threadId,
}: TokenCounterProps) {
  const [autoSummary] = appStore(useShallow((state) => [state.autoSummary]));

  const { data: preferences } = useSWR<UserPreferences>(
    "/api/user/preferences",
    fetcher,
  );

  const maxContextTokens = useMemo(() => {
    if (!preferences?.generation) return DEFAULT_MAX_CONTEXT;

    const generation = preferences.generation;
    const modelKey = chatModel
      ? `${chatModel.provider}:${chatModel.model}`
      : null;

    if (modelKey && generation.maxContextTokensByModel?.[modelKey]) {
      return generation.maxContextTokensByModel[modelKey];
    }

    return generation.maxContextTokensDefault ?? DEFAULT_MAX_CONTEXT;
  }, [preferences, chatModel]);

  // Match backend budgeting logic (src/app/api/chat/route.ts):
  // maxInputTokens = maxContextTokens - maxOutputTokens
  const budgets = useMemo(() => {
    const generation = preferences?.generation;
    const advanced = generation?.advanced;
    const advancedEnabled = Boolean(advanced?.enabled);

    const fallbackMaxOutputTokens =
      chatModel?.provider === "nvidia" ? 8192 : 4096;
    const configuredMaxOutputTokens = advancedEnabled
      ? advanced?.maxOutputTokens
      : undefined;

    const maxOutputTokens = Math.max(
      128,
      Math.min(
        configuredMaxOutputTokens ?? fallbackMaxOutputTokens,
        // keep some room for the prompt
        Math.max(128, maxContextTokens - 1024),
      ),
    );
    const maxInputTokens = Math.max(1024, maxContextTokens - maxOutputTokens);

    return {
      maxOutputTokens,
      maxInputTokens,
      triggerThreshold: maxInputTokens * SUMMARY_TRIGGER_THRESHOLD,
    };
  }, [preferences, chatModel?.provider, maxContextTokens]);

  const breakdown = useMemo(
    () => analyzeMessages(messages, autoSummary),
    [messages, autoSummary],
  );

  const { data: serverMessages } = useSWR<UIMessage[]>(
    threadId ? `/api/chat/${threadId}` : null,
    fetcher,
    {
      dedupingInterval: 2000,
      refreshInterval: threadId ? 4000 : 0,
      revalidateOnFocus: true,
    },
  );
  const serverBreakdown = useMemo(() => {
    if (!serverMessages) return null;
    return analyzeMessages(serverMessages, autoSummary);
  }, [serverMessages, autoSummary]);

  // The threshold for the gauge depends on mode:
  // - Auto-Summary ON: Threshold is 80% (when it triggers)
  // - Auto-Summary OFF: Threshold is 100% (hard limit)
  const effectiveThreshold = autoSummary
    ? budgets.triggerThreshold
    : budgets.maxInputTokens;

  // Calculate progress toward threshold (0-100%)
  const progressPercent = Math.min(
    100,
    (breakdown.estimatedContextSent / effectiveThreshold) * 100,
  );

  // Format number with K suffix for thousands
  const formatTokens = (n: number) => {
    if (n >= 1000) {
      return `${(n / 1000).toFixed(1)}k`;
    }
    return n.toString();
  };

  // Color based on proximity to threshold
  const getColor = () => {
    if (progressPercent >= 95) return "text-red-500"; // Critical
    if (progressPercent >= 80) return "text-amber-500"; // Warning
    if (progressPercent >= 60) return "text-yellow-500"; // Caution
    return "text-muted-foreground"; // Safe
  };

  // Background color for progress indicator
  const getProgressColor = () => {
    if (progressPercent >= 95) return "bg-red-500";
    if (progressPercent >= 80) return "bg-amber-500";
    if (progressPercent >= 60) return "bg-yellow-500";
    return "bg-green-500";
  };

  if (messages.length === 0) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex items-center gap-1.5 text-xs cursor-default select-none",
            getColor(),
            className,
          )}
        >
          <Gauge className="size-3" />
          <span className="tabular-nums">
            {formatTokens(breakdown.estimatedContextSent)}
          </span>
          {/* Mini progress bar */}
          <div className="w-8 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-300",
                getProgressColor(),
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs w-64">
        <div className="flex flex-col gap-2">
          <div className="font-semibold flex items-center gap-1.5">
            <Gauge className="size-3.5" />
            Context Usage
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-300",
                getProgressColor(),
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Stats */}
          <div className="space-y-1 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Sent to AI:</span>
              <span className="tabular-nums font-medium">
                ~{formatTokens(breakdown.estimatedContextSent)} tokens
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {autoSummary ? "Summary threshold:" : "Context limit:"}
              </span>
              <span
                className={cn(
                  "tabular-nums font-medium",
                  autoSummary && "text-amber-600",
                )}
              >
                {autoSummary
                  ? `${formatTokens(budgets.triggerThreshold)} (80% of input budget)`
                  : `${formatTokens(budgets.maxInputTokens)} (input budget)`}
              </span>
            </div>

            {autoSummary && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  Full context limit:
                </span>
                <span className="tabular-nums">
                  {formatTokens(maxContextTokens)} tokens
                </span>
              </div>
            )}

            {autoSummary && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Input budget:</span>
                <span className="tabular-nums">
                  {formatTokens(budgets.maxInputTokens)} tokens
                </span>
              </div>
            )}

            {autoSummary && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Reserved output:</span>
                <span className="tabular-nums">
                  {formatTokens(budgets.maxOutputTokens)} tokens
                </span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                Until {autoSummary ? "auto-summary" : "hard limit"}:
              </span>
              <span className="tabular-nums">
                {autoSummary ? (
                  budgets.triggerThreshold - breakdown.estimatedContextSent >
                  0 ? (
                    `~${formatTokens(budgets.triggerThreshold - breakdown.estimatedContextSent)}`
                  ) : (
                    "Will trigger"
                  )
                ) : budgets.maxInputTokens - breakdown.estimatedContextSent >
                  0 ? (
                  `~${formatTokens(budgets.maxInputTokens - breakdown.estimatedContextSent)}`
                ) : (
                  <span className="text-red-500 font-bold">Overflow</span>
                )}
              </span>
            </div>

            {threadId && serverBreakdown && (
              <>
                <div className="border-t border-border pt-1 mt-1" />
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>DB summary:</span>
                  <span className="tabular-nums">
                    {serverBreakdown.hasSummary ? "Yes" : "No"}
                  </span>
                </div>
                {serverBreakdown.hasSummary !== breakdown.hasSummary && (
                  <div className="text-[10px] text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="size-3" />
                    UI vs DB mismatch (UI: {breakdown.hasSummary ? "yes" : "no"}
                    , DB: {serverBreakdown.hasSummary ? "yes" : "no"})
                  </div>
                )}
              </>
            )}

            {breakdown.hasSummary ? (
              <>
                <div className="border-t border-border pt-1 mt-1" />
                <div className="flex items-center justify-between text-green-600">
                  <span className="flex items-center gap-1">
                    <FileText className="size-3" />
                    Summary:
                  </span>
                  <span className="tabular-nums">
                    {breakdown.summarizedCount} msgs → ~
                    {formatTokens(breakdown.summaryTokens)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>New messages kept:</span>
                  <span className="tabular-nums">
                    {messages.length - 1 - breakdown.summaryIdx} msgs
                  </span>
                </div>
              </>
            ) : !autoSummary && breakdown.totalInUI > budgets.maxInputTokens ? (
              <>
                <div className="border-t border-border pt-1 mt-1" />
                <div className="text-[10px] text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="size-3" />
                  Older messages will be trimmed
                </div>
              </>
            ) : null}

            <div className="border-t border-border pt-1 mt-1" />
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Full history ({breakdown.messageCount} msgs):</span>
              <span className="tabular-nums">
                ~{formatTokens(breakdown.totalInUI)}
              </span>
            </div>
          </div>

          {/* Status message */}
          <div className="text-[10px] pt-1 border-t border-border">
            {progressPercent >= 95 ? (
              <span className="text-red-500 flex items-center gap-1">
                <AlertTriangle className="size-3" />
                Summary will trigger on next message
              </span>
            ) : progressPercent >= 80 ? (
              <span className="text-amber-500 flex items-center gap-1">
                <AlertTriangle className="size-3" />
                Approaching summary threshold
              </span>
            ) : breakdown.hasSummary ? (
              <span className="text-green-600 flex items-center gap-1">
                <Zap className="size-3" />
                Context optimized with summary
              </span>
            ) : (
              <span className="text-muted-foreground">
                Context size is healthy
              </span>
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export const TokenCounter = memo(PureTokenCounter);
TokenCounter.displayName = "TokenCounter";
