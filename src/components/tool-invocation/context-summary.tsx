"use client";

import { memo } from "react";
import { Separator } from "ui/separator";
import { TextShimmer } from "ui/text-shimmer";
import { FileText, CheckCircle2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";

interface ContextSummaryProps {
  state: "pending" | "result" | "error";
  summarizedCount?: number;
  summarizedTokens?: number;
  errorMessage?: string;
}

function PureContextSummary({
  state,
  summarizedCount = 0,
  summarizedTokens = 0,
  errorMessage,
}: ContextSummaryProps) {
  const t = useTranslations("Chat.Tool");

  // Loading state - show shimmer like web search
  if (state === "pending") {
    return (
      <div className="flex items-center gap-2 text-sm">
        <FileText className="size-5 wiggle text-amber-500" />
        <TextShimmer>{t("summarizingConversation")}</TextShimmer>
      </div>
    );
  }

  // Error state - show red error with message
  if (state === "error") {
    return (
      <div className="flex items-center gap-2 text-sm">
        <XCircle className="size-5 text-red-500" />
        <span className="text-red-500 font-medium">{t("summaryFailed")}</span>
        {errorMessage && (
          <span className="text-xs text-muted-foreground">
            ({errorMessage})
          </span>
        )}
      </div>
    );
  }

  // Result state - show completed summary info with green checkmark
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="size-5 text-green-500" />
        <span className="text-sm font-semibold">
          {t("conversationSummarized")}
        </span>
        <span className="text-xs text-muted-foreground">
          {t("messagesTokensCompressed", {
            count: summarizedCount,
            tokens: Math.round(summarizedTokens / 1000),
          })}
        </span>
      </div>
      <div className="flex gap-2">
        <div className="px-2.5">
          <Separator
            orientation="vertical"
            className="bg-gradient-to-b from-green-500/30 to-transparent from-80%"
          />
        </div>
        <div className="flex flex-col gap-1 pb-2">
          <p className="text-xs text-muted-foreground">
            {t("summaryExplanation1")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("summaryExplanation2")}
          </p>
        </div>
      </div>
    </div>
  );
}

export const ContextSummary = memo(PureContextSummary, (prev, next) => {
  return (
    prev.state === next.state &&
    prev.summarizedCount === next.summarizedCount &&
    prev.errorMessage === next.errorMessage
  );
});

ContextSummary.displayName = "ContextSummary";
