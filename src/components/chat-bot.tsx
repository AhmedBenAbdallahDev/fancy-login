"use client";

import { useChat } from "@ai-sdk/react";
import { toast } from "sonner";
import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import PromptInput from "./prompt-input";
import clsx from "clsx";
import { appStore } from "@/app/store";
import {
  cn,
  createDebounce,
  fetcher,
  generateUUID,
  truncateString,
} from "lib/utils";
import { ErrorMessage, PreviewMessage } from "./message";
import { ChatGreeting } from "./chat-greeting";
import { ContextSummary } from "./tool-invocation/context-summary";

import { useShallow } from "zustand/shallow";
import { UIMessage } from "ai";

import { safe } from "ts-safe";
import useSWR, { mutate } from "swr";
import {
  ChatApiSchemaRequestBody,
  ChatModel,
  ClientToolInvocation,
} from "app-types/chat";
import { UserPreferences } from "app-types/user";
import { isShortcutEvent, Shortcuts } from "lib/keyboard-shortcuts";
import { Button } from "ui/button";
import { deleteThreadAction } from "@/app/api/chat/actions";
import { useRouter } from "next/navigation";
import { Loader } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "ui/dialog";
import { useTranslations } from "next-intl";
import { Think } from "ui/think";
import { useGenerateThreadTitle } from "@/hooks/queries/use-generate-thread-title";
import dynamic from "next/dynamic";
import { useMounted } from "@/hooks/use-mounted";
import { useWindowSize } from "@/hooks/use-window-size";
import { DebugSlider } from "ui/debug-slider";

function hasSummaryBadge(messages: UIMessage[] | undefined): boolean {
  if (!messages?.length) return false;
  return messages.some((m) => {
    const annotations = m.annotations as any[] | undefined;
    return annotations?.some((a) => a?.isSummaryBadge) ?? false;
  });
}

async function fetchThreadMessagesNoStore(
  threadId: string,
): Promise<UIMessage[]> {
  const res = await fetch(`/api/chat/${threadId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch messages: ${res.status}`);
  return (await res.json()) as UIMessage[];
}

type Props = {
  threadId: string;
  initialMessages: Array<UIMessage>;
  isRoleplay?: boolean;
  selectedChatModel?: string;
  isNewChat?: boolean;
  slots?: {
    emptySlot?: ReactNode;
    inputBottomSlot?: ReactNode;
  };
};

const LightRays = dynamic(() => import("ui/light-rays"), {
  ssr: false,
});

const Particles = dynamic(() => import("ui/particles"), {
  ssr: false,
});

const debounce = createDebounce();

const version = "0.0.0";
const isFirstTime = !localStorage.getItem(`V_${version}`);
localStorage.setItem(`V_${version}`, "true");

export default function ChatBot({
  threadId,
  initialMessages,
  isRoleplay,
  slots,
  isNewChat,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [thinking, setThinking] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const [
    appStoreMutate,
    model,
    toolChoice,
    autoSummary,
    allowedAppDefaultToolkit,
    allowedMcpServers,
    threadList,
    threadMentions,
  ] = appStore(
    useShallow((state) => [
      state.mutate,
      state.chatModel,
      state.toolChoice,
      state.autoSummary,
      state.allowedAppDefaultToolkit,
      state.allowedMcpServers,
      state.threadList,
      state.threadMentions,
    ]),
  );

  const generateTitle = useGenerateThreadTitle({
    threadId,
  });

  // Fetch messages client-side for instant navigation and caching
  const {
    data: cachedMessages,
    isLoading: isMessagesLoading,
    error: swrError,
  } = useSWR<UIMessage[]>(
    !isNewChat ? `/api/chat/${threadId}` : null,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 60000,
      fallbackData: initialMessages.length > 0 ? initialMessages : undefined,
    },
  );

  const { data: userPreferences } = useSWR<UserPreferences>(
    threadId ? "/api/user/preferences" : null,
    fetcher,
    {
      dedupingInterval: 60000,
      revalidateOnFocus: false,
    },
  );

  // Use a ref to access latest values in callbacks without triggering re-renders or stale closures
  const latestRef = useRef({
    toolChoice,
    autoSummary,
    model,
    allowedAppDefaultToolkit,
    allowedMcpServers,
    messages: [] as UIMessage[],
    threadList,
    threadId,
    mentions: threadMentions[threadId],
  });

  // Update ref on every render
  useEffect(() => {
    latestRef.current = {
      toolChoice,
      autoSummary,
      model,
      allowedAppDefaultToolkit,
      allowedMcpServers,
      messages,
      threadList,
      threadId,
      mentions: threadMentions[threadId],
    };
  });

  const {
    messages,
    input,
    setInput,
    append,
    status,
    reload,
    setMessages,
    addToolResult,
    error,
    stop,
    data: streamData,
  } = useChat({
    id: threadId,
    api: "/api/chat",
    initialMessages: cachedMessages || initialMessages,
    experimental_prepareRequestBody: ({ messages, requestBody }) => {
      if (window.location.pathname !== `/chat/${threadId}`) {
        console.log("replace-state");
        window.history.replaceState({}, "", `/chat/${threadId}`);
      }
      const lastMessage = messages.at(-1)!;
      vercelAISdkV4ToolInvocationIssueCatcher(lastMessage);
      const request: ChatApiSchemaRequestBody = {
        id: latestRef.current.threadId,
        thinking,
        autoSummary: latestRef.current.autoSummary,
        chatModel:
          (requestBody as { model: ChatModel })?.model ??
          latestRef.current.model,
        toolChoice: latestRef.current.toolChoice,
        allowedAppDefaultToolkit: latestRef.current.mentions?.length
          ? []
          : latestRef.current.allowedAppDefaultToolkit,
        allowedMcpServers: latestRef.current.mentions?.length
          ? {}
          : latestRef.current.allowedMcpServers,
        mentions: latestRef.current.mentions,
        message: lastMessage,
      };
      return request;
    },
    sendExtraMessageFields: true,
    generateId: generateUUID,
    experimental_throttle: 100,
    onFinish(message) {
      const messages = latestRef.current.messages;
      const prevThread = latestRef.current.threadList.find(
        (v) => v.id === threadId,
      );
      const isNewThread =
        !prevThread?.title &&
        messages.filter((v) => v.role === "user" || v.role === "assistant")
          .length < 3;
      if (isNewThread) {
        const part = messages
          .slice(0, 2)
          .flatMap((m) =>
            m.parts
              .filter((v) => v.type === "text")
              .map((p) => `${m.role}: ${truncateString(p.text, 500)}`),
          );
        if (part.length > 0) {
          generateTitle(part.join("\n\n"));
        }
      } else if (latestRef.current.threadList[0]?.id !== threadId) {
        mutate("/api/thread");
      }

      // Check if summary was created or is pending - handle both states
      const annotations = message.annotations as any[] | undefined;

      // Check for summary-pending (start of summarization)
      if (annotations?.some((a) => a.type === "summary-pending")) {
        setIsSummarizing(true);
      }

      // Check for summary-created (end of summarization)
      if (annotations?.some((a) => a.type === "summary-created")) {
        setIsSummarizing(false);
        // Refetch messages to include the summary message in the list
        mutate(`/api/chat/${threadId}`);
      }
    },
    onError: (error) => {
      setIsSummarizing(false); // Clear summarizing state on error
      console.error(error);
      toast.error(
        truncateString(error.message, 100) ||
          "An error occured, please try again!",
      );
    },
  });

  // Track summary error state
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // When a summary is created during streaming, we must wait until the stream is finished
  // before replacing messages from the server, otherwise the streaming state can overwrite it.
  const summaryCreatedDuringStreamRef = useRef(false);

  // Watch stream data for summary annotations (they come before onFinish)
  useEffect(() => {
    if (!streamData || streamData.length === 0) return;

    // Check for summary signals in stream data
    // Note: writeData sends objects directly, check both nested and flat structures
    const hasPending = streamData.some(
      (d: any) => d?.type === "summary-pending" || d === "summary-pending",
    );
    const hasCreated = streamData.some(
      (d: any) => d?.type === "summary-created" || d === "summary-created",
    );
    const failedData = streamData.find(
      (d: any) => d?.type === "summary-failed",
    ) as { type: string; error?: string } | undefined;

    if (failedData) {
      setIsSummarizing(false);
      setSummaryError(failedData.error || "Summary generation failed");
      toast.error(`Summary failed: ${failedData.error || "Unknown error"}`);
    } else if (hasCreated) {
      setIsSummarizing(false);
      setSummaryError(null);
      // Mark for post-stream sync. Do NOT setMessages here.
      summaryCreatedDuringStreamRef.current = true;
    } else if (hasPending) {
      setIsSummarizing(true);
      setSummaryError(null);
    }
  }, [streamData, threadId, setMessages]);

  // Clear summary error when starting a new message
  useEffect(() => {
    if (status === "submitted") {
      setSummaryError(null);
    }
  }, [status]);

  // Track previous status for transition detection
  const prevStatusRef = useRef(status);

  // When streaming finishes, ALWAYS refetch messages to pick up any new summary or sync state
  useEffect(() => {
    const wasReady = prevStatusRef.current === "ready";
    const isNowReady = status === "ready";
    prevStatusRef.current = status;

    // If we just transitioned into ready (from any non-ready state), sync from server.
    if (!wasReady && isNowReady) {
      const expectSummary = summaryCreatedDuringStreamRef.current;
      summaryCreatedDuringStreamRef.current = false;

      setTimeout(
        async () => {
          try {
            let freshMessages = await fetchThreadMessagesNoStore(threadId);

            // If auto-summary is enabled, DB writes can sometimes land after we first read.
            // When we didn't observe the stream signal, do a single delayed retry to avoid
            // missing the persisted summary badge.
            if (
              autoSummary &&
              !expectSummary &&
              !hasSummaryBadge(freshMessages) &&
              !hasSummaryBadge(messages)
            ) {
              await new Promise((r) => setTimeout(r, 1200));
              freshMessages = await fetchThreadMessagesNoStore(threadId);
            }

            if (expectSummary && !hasSummaryBadge(freshMessages)) {
              // DB write can lag behind the stream; retry a few times.
              const retryDelays = [250, 500, 800, 1200];
              for (const delayMs of retryDelays) {
                await new Promise((r) => setTimeout(r, delayMs));
                freshMessages = await fetchThreadMessagesNoStore(threadId);
                if (hasSummaryBadge(freshMessages)) break;
              }
            }

            setMessages(freshMessages);
          } catch (e) {
            console.error("Failed to refetch messages after stream:", e);
            // Fallback: use SWR mutate
            try {
              const swrMessages = await mutate(`/api/chat/${threadId}`);
              if (swrMessages && Array.isArray(swrMessages)) {
                setMessages(swrMessages);
              }
            } catch (e2) {
              console.error("Fallback SWR mutate also failed:", e2);
            }
          }
        },
        expectSummary ? 900 : 400,
      );
      setIsSummarizing(false); // Always clear summarizing state when done
    }
  }, [status, threadId, setMessages, autoSummary, messages]);

  // Sync cached messages when they update (e.g., background revalidation finds new data)
  useEffect(() => {
    if (cachedMessages && cachedMessages.length > 0 && messages.length === 0) {
      setMessages(cachedMessages);
    }
  }, [cachedMessages, messages.length, setMessages]);

  const [isDeleteThreadPopupOpen, setIsDeleteThreadPopupOpen] = useState(false);
  const mounted = useMounted();

  const isRoleplayThread = useMemo(() => {
    if (typeof isRoleplay === "boolean") return isRoleplay;
    const thread = threadList.find((t) => t.id === threadId);
    return !!thread?.characterId;
  }, [isRoleplay, threadList, threadId]);

  const narrationOpacity = useMemo(() => {
    const value = userPreferences?.roleplay?.narrationOpacity;
    if (typeof value !== "number" || Number.isNaN(value)) return 0.65;
    return Math.min(1, Math.max(0.2, value));
  }, [userPreferences?.roleplay?.narrationOpacity]);

  const isLoading = useMemo(
    () => status === "streaming" || status === "submitted",
    [status],
  );

  const emptyMessage = useMemo(
    () => messages.length === 0 && !error && (!isMessagesLoading || !!swrError),
    [messages.length, error, isMessagesLoading, swrError],
  );

  const [lightOpacity, setLightOpacity] = useState(0); // Start hidden for smooth fade-in

  // Smart fade-in: always visible on home, interaction-based in chat
  useEffect(() => {
    if (emptyMessage) {
      // Home page: smooth fade-in after component mounts
      const timer = setTimeout(() => {
        setLightOpacity(1);
      }, 500); // 500ms delay before fade-in starts
      return () => clearTimeout(timer);
    } else {
      // Chat page: start with first-time behavior
      if (isFirstTime) {
        // First time: smooth fade-in
        const timer = setTimeout(() => {
          setLightOpacity(1);
        }, 1000); // 1 second delay for first visit
        return () => clearTimeout(timer);
      } else {
        // Returning user: start hidden, wait for idle
        setLightOpacity(0);
      }
    }
  }, [emptyMessage]);

  const isInitialThreadEntry = useMemo(
    () =>
      initialMessages.length > 0 &&
      initialMessages.at(-1)?.id === messages.at(-1)?.id,
    [messages],
  );

  const needSpaceClass = useCallback(
    (index: number) => {
      if (error || isInitialThreadEntry || index != messages.length - 1)
        return false;
      const message = messages[index];
      if (message.role === "user") return false;
      if (message.parts.at(-1)?.type == "step-start") return false;
      return true;
    },
    [messages, error],
  );

  const [isExecutingProxyToolCall, setIsExecutingProxyToolCall] =
    useState(false);
  const [isBranching, setIsBranching] = useState(false);
  const router = useRouter();

  const handleBranch = useCallback(
    (messageId: string) => {
      setIsBranching(true);
      safe(async () => {
        const response = await fetch("/api/chat/branch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threadId, messageId }),
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to branch chat");
        }
        const { thread } = await response.json();
        // Invalidate thread list cache to include the new branch
        mutate("/api/thread");
        toast.success("Chat branched successfully");
        // Navigate to the new branched thread
        router.push(`/chat/${thread.id}`);
        return thread;
      })
        .ifFail((error) => toast.error(error.message))
        .watch(() => setIsBranching(false))
        .unwrap();
    },
    [threadId, router],
  );

  const isPendingToolCall = useMemo(() => {
    if (status != "ready") return false;
    const lastMessage = messages.at(-1);
    if (lastMessage?.role != "assistant") return false;
    const lastPart = lastMessage.parts.at(-1);
    if (!lastPart) return false;
    if (lastPart.type != "tool-invocation") return false;
    if (lastPart.toolInvocation.state == "result") return false;
    return true;
  }, [status, messages]);

  const proxyToolCall = useCallback((result: ClientToolInvocation) => {
    setIsExecutingProxyToolCall(true);
    return safe(async () => {
      const lastMessage = latestRef.current.messages.at(-1)!;
      const lastPart = lastMessage.parts.at(-1)! as Extract<
        UIMessage["parts"][number],
        { type: "tool-invocation" }
      >;
      return addToolResult({
        toolCallId: lastPart.toolInvocation.toolCallId,
        result,
      });
    })
      .watch(() => setIsExecutingProxyToolCall(false))
      .unwrap();
  }, []);

  const handleThinkingChange = useCallback((thinking: boolean) => {
    setThinking(thinking);
  }, []);

  const space = useMemo(() => {
    if (!isLoading) return false;
    const lastMessage = messages.at(-1);
    if (lastMessage?.role == "user") return "think";
    const lastPart = lastMessage?.parts.at(-1);
    if (lastPart?.type == "step-start")
      return lastMessage?.parts.length == 1 ? "think" : "space";
    return false;
  }, [isLoading, messages.at(-1)]);

  const { width, height } = useWindowSize();
  const isPortrait = height > width;
  const [intensity, setIntensity] = useState(1);
  const [lightSpread, setLightSpread] = useState(1);
  const [rayLength, setRayLength] = useState(2);
  const [fadeDistance, setFadeDistance] = useState(1);
  const [saturation, setSaturation] = useState(1);
  const [showDebug, setShowDebug] = useState(false);

  const handleFocus = useCallback(() => {
    // Only hide light effects when NOT on home page
    if (emptyMessage) return; // Home page: do nothing

    // Chat page: smooth fade out and restart idle timer
    setLightOpacity(0);
    debounce(() => {
      setLightOpacity(1);
    }, 30000); // 30 seconds idle
  }, [emptyMessage]);

  const particle = useMemo(() => {
    const particleCount = emptyMessage
      ? 400
      : isPortrait
        ? 200 * intensity
        : 400;
    const particleBaseSize = emptyMessage
      ? 10
      : isPortrait
        ? 5 * intensity
        : 10;

    // Always render, but control with opacity
    return (
      <div
        className="absolute top-0 left-0 w-full h-full transition-opacity duration-2000 ease-in-out"
        style={{ opacity: lightOpacity }}
      >
        <div className="absolute top-0 left-0 w-full h-full z-10 fade-in animate-in duration-5000">
          <LightRays
            lightSpread={lightSpread}
            rayLength={rayLength}
            fadeDistance={fadeDistance}
            saturation={saturation}
          />
        </div>
        <div className="absolute top-0 left-0 w-full h-full z-10 fade-in animate-in duration-5000">
          <Particles
            particleCount={particleCount}
            particleBaseSize={particleBaseSize}
          />
        </div>

        <div className="absolute top-0 left-0 w-full h-full z-10 fade-in animate-in duration-5000">
          <div className="w-full h-full bg-gradient-to-t from-background to-50% to-transparent z-20" />
        </div>
        <div className="absolute top-0 left-0 w-full h-full z-10 fade-in animate-in duration-5000">
          <div className="w-full h-full bg-gradient-to-l from-background to-20% to-transparent z-20" />
        </div>
        <div className="absolute top-0 left-0 w-full h-full z-10 fade-in animate-in duration-5000">
          <div className="w-full h-full bg-gradient-to-r from-background to-20% to-transparent z-20" />
        </div>
      </div>
    );
  }, [
    lightOpacity,
    isPortrait,
    emptyMessage,
    intensity,
    lightSpread,
    rayLength,
    fadeDistance,
    saturation,
  ]);

  useEffect(() => {
    const keysPressed: { [key: string]: boolean } = {};
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed[e.key] = true;
      if (keysPressed["p"] && keysPressed["m"]) {
        setShowDebug((prev) => !prev);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed[e.key] = false;
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (mounted && !emptyMessage) {
      // Only trigger handleFocus in chat, not on home
      handleFocus();
    }
  }, [input, mounted, emptyMessage, handleFocus]);

  // Update app store with current thread
  useEffect(() => {
    appStoreMutate({ currentThreadId: threadId });
    return () => {
      appStoreMutate({ currentThreadId: null });
    };
  }, [threadId]);

  useEffect(() => {
    if (isInitialThreadEntry)
      containerRef.current?.scrollTo({
        top: containerRef.current?.scrollHeight,
        behavior: "instant",
      });
  }, [isInitialThreadEntry]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const messages = latestRef.current.messages;
      if (messages.length === 0) return;
      const isLastMessageCopy = isShortcutEvent(e, Shortcuts.lastMessageCopy);
      const isDeleteThread = isShortcutEvent(e, Shortcuts.deleteThread);
      if (!isDeleteThread && !isLastMessageCopy) return;
      e.preventDefault();
      e.stopPropagation();
      if (isLastMessageCopy) {
        const lastMessage = messages.at(-1);
        const lastMessageText = lastMessage!.parts
          .filter((part) => part.type == "text")
          ?.at(-1)?.text;
        if (!lastMessageText) return;
        navigator.clipboard.writeText(lastMessageText);
        toast.success("Last message copied to clipboard");
      }
      if (isDeleteThread) {
        setIsDeleteThreadPopupOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      {particle}
      <div
        className={cn(
          emptyMessage && "justify-center pb-24",
          "flex flex-col min-w-0 relative h-full z-40",
        )}
      >
        {emptyMessage ? (
          slots?.emptySlot ? (
            slots.emptySlot
          ) : (
            <ChatGreeting />
          )
        ) : (
          <>
            <div
              className={"flex flex-col gap-2 overflow-y-auto py-6 z-10"}
              ref={containerRef}
              onScroll={emptyMessage ? undefined : handleFocus} // Only trigger in chat
            >
              {messages.map((message, index) => {
                const isLastMessage = messages.length - 1 === index;
                return (
                  <PreviewMessage
                    threadId={threadId}
                    isRoleplay={isRoleplayThread}
                    narrationOpacity={narrationOpacity}
                    messageIndex={index}
                    key={
                      message.id ??
                      (message.createdAt
                        ? new Date(message.createdAt as any).getTime()
                        : index)
                    }
                    message={message}
                    status={status}
                    onPoxyToolCall={
                      isPendingToolCall &&
                      !isExecutingProxyToolCall &&
                      isLastMessage
                        ? proxyToolCall
                        : undefined
                    }
                    isLoading={isLoading || isPendingToolCall}
                    isError={!!error && isLastMessage}
                    isLastMessage={isLastMessage}
                    setMessages={setMessages}
                    reload={reload}
                    className={
                      needSpaceClass(index) ? "min-h-[calc(55dvh-40px)]" : ""
                    }
                    onBranch={isRoleplayThread ? handleBranch : undefined}
                    isBranching={isBranching}
                  />
                );
              })}
              {space && (
                <>
                  <div className="w-full mx-auto max-w-3xl px-6 relative">
                    <div className={space == "space" ? "opacity-0" : ""}>
                      <Think />
                    </div>
                  </div>
                  <div className="min-h-[calc(55dvh-56px)]" />
                </>
              )}

              {/* Show summarization indicator when active or error */}
              {isSummarizing && (
                <div className="w-full mx-auto max-w-3xl px-6">
                  <ContextSummary state="pending" />
                </div>
              )}
              {summaryError && !isSummarizing && (
                <div className="w-full mx-auto max-w-3xl px-6">
                  <ContextSummary state="error" errorMessage={summaryError} />
                </div>
              )}

              {error && <ErrorMessage error={error} />}
              <div className="min-w-0 min-h-52" />
            </div>
          </>
        )}
        <div
          className={clsx(
            messages.length && "absolute bottom-14",
            "w-full z-10",
          )}
        >
          <PromptInput
            input={input}
            threadId={threadId}
            append={append}
            thinking={thinking}
            setInput={setInput}
            onThinkingChange={handleThinkingChange}
            isLoading={isLoading || isPendingToolCall}
            onStop={stop}
            onFocus={emptyMessage ? undefined : handleFocus} // Only trigger in chat
            messages={messages}
          />
          {slots?.inputBottomSlot}
        </div>
        <DeleteThreadPopup
          threadId={threadId}
          onClose={() => setIsDeleteThreadPopupOpen(false)}
          open={isDeleteThreadPopupOpen}
        />
        {showDebug && !emptyMessage && (
          <DebugSlider
            intensity={intensity}
            onIntensityChange={(e) => setIntensity(parseFloat(e.target.value))}
            lightSpread={lightSpread}
            onLightSpreadChange={(e) =>
              setLightSpread(parseFloat(e.target.value))
            }
            rayLength={rayLength}
            onRayLengthChange={(e) => setRayLength(parseFloat(e.target.value))}
            fadeDistance={fadeDistance}
            onFadeDistanceChange={(e) =>
              setFadeDistance(parseFloat(e.target.value))
            }
            saturation={saturation}
            onSaturationChange={(e) =>
              setSaturation(parseFloat(e.target.value))
            }
          />
        )}
      </div>
    </>
  );
}

function vercelAISdkV4ToolInvocationIssueCatcher(message: UIMessage) {
  if (message.role != "assistant") return;
  const lastPart = message.parts.at(-1);
  if (lastPart?.type != "tool-invocation") return;
  if (!message.toolInvocations)
    message.toolInvocations = [lastPart.toolInvocation];
}

function DeleteThreadPopup({
  threadId,
  onClose,
  open,
}: { threadId: string; onClose: () => void; open: boolean }) {
  const t = useTranslations();
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const handleDelete = useCallback(() => {
    setIsDeleting(true);
    safe(() => deleteThreadAction(threadId))
      .watch(() => setIsDeleting(false))
      .ifOk(() => {
        // Update store immediately for responsiveness
        appStore.setState((prev) => ({
          threadList: prev.threadList.filter((t) => t.id !== threadId),
        }));
        toast.success(t("Chat.Thread.threadDeleted"));
        // Invalidate the thread list cache to remove deleted thread from sidebar
        mutate("/api/thread");
        router.push("/");
      })
      .ifFail(() => toast.error(t("Chat.Thread.failedToDeleteThread")))
      .watch(() => onClose());
  }, [threadId, router]);
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Chat.Thread.deleteChat")}</DialogTitle>
          <DialogDescription>
            {t("Chat.Thread.areYouSureYouWantToDeleteThisChatThread")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("Common.cancel")}
          </Button>
          <Button variant="destructive" onClick={handleDelete} autoFocus>
            {t("Common.delete")}
            {isDeleting && <Loader className="size-3.5 ml-2 animate-spin" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
