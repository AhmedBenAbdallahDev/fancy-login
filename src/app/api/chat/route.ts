import {
  appendResponseMessages,
  createDataStreamResponse,
  smoothStream,
  streamText,
  generateText,
  type UIMessage,
  formatDataStreamPart,
  appendClientMessage,
  Message,
} from "ai";
import { getEncoding } from "js-tiktoken";

const encoding = getEncoding("cl100k_base");

import {
  customModelProvider,
  isToolCallUnsupportedModel,
  isSimulatedToolModel,
} from "lib/ai/models";

import { mcpClientsManager } from "lib/ai/mcp/mcp-manager";

import {
  agentRepository,
  chatRepository,
  personaRepository,
  stylePresetRepository,
  characterRepository,
  userRepository,
} from "lib/db/repository";
import globalLogger from "logger";
import {
  buildMcpServerCustomizationsSystemPrompt,
  buildUserSystemPrompt,
  buildToolCallUnsupportedModelSystemPrompt,
  buildThinkingSystemPrompt,
  buildRoleplaySystemPrompt,
} from "lib/ai/prompts";
import { chatApiSchemaRequestBodySchema, ChatMessage } from "app-types/chat";

import { errorIf, safe } from "ts-safe";

import {
  appendAnnotations,
  excludeToolExecution,
  handleError,
  manualToolExecuteByLastMessage,
  mergeSystemPrompt,
  convertToMessage,
  extractInProgressToolPart,
  assignToolResult,
  filterMcpServerCustomizations,
  loadMcpTools,
  loadWorkFlowTools,
  loadAppDefaultTools,
} from "./shared.chat";
import {
  rememberAgentAction,
  rememberMcpServerCustomizationsAction,
} from "./actions";
import { getSession } from "auth/server";
import { colorize } from "consola/utils";
import { isVercelAIWorkflowTool } from "app-types/workflow";
import { SequentialThinkingToolName } from "lib/ai/tools";
import { sequentialThinkingTool } from "lib/ai/tools/thinking/sequential-thinking";
import {
  SimulatedToolBuffer,
  generateToolSchemaPrompt,
} from "lib/ai/simulated-tools";
const logger = globalLogger.withDefaults({
  message: colorize("blackBright", `Chat API: `),
});

function estimateTokensFromText(text: string): number {
  if (!text) return 0;
  try {
    return encoding.encode(text).length;
  } catch (_e) {
    // Fallback if encoding fails
    return Math.ceil(text.length / 4);
  }
}

function estimateRequestTokens(system: string, messages: Message[]): number {
  return (
    estimateTokensFromText(system) +
    estimateTokensFromText(JSON.stringify(messages))
  );
}

function estimateMessageTokens(message: Message): number {
  return estimateTokensFromText(JSON.stringify(message.content));
}

// Truncate a single message's content to fit within token limit
function truncateMessageContent(message: Message, maxTokens: number): Message {
  const content = message.content;
  if (typeof content !== "string") {
    // For array content (like parts), stringify and estimate
    const contentStr = JSON.stringify(content);
    const currentTokens = estimateTokensFromText(contentStr);
    if (currentTokens <= maxTokens) return message;

    // For complex content, we can't easily truncate - return as-is and let API error
    return message;
  }

  // For string content, truncate directly
  const currentTokens = estimateTokensFromText(content);
  if (currentTokens <= maxTokens) return message;

  // Truncate to ~maxTokens (chars ≈ tokens * 4)
  const maxChars = maxTokens * 4;
  const truncatedContent =
    content.slice(0, maxChars) +
    "\n\n[... Content truncated due to length. Original was ~" +
    Math.round(currentTokens / 1000) +
    "k tokens ...]";

  return {
    ...message,
    content: truncatedContent,
  };
}

function trimMessagesToFit(
  system: string,
  messages: Message[],
  maxInputTokens: number,
): Message[] {
  if (messages.length <= 1) {
    // Single message case: check if it needs truncation
    if (messages.length === 1) {
      const msgTokens = estimateMessageTokens(messages[0]);
      const systemTokens = estimateTokensFromText(system);
      const available = maxInputTokens - systemTokens - 500; // 500 token buffer

      if (msgTokens > available) {
        logger.warn(
          `Single message too large (${msgTokens} tokens), truncating to fit ${available} tokens`,
        );
        return [truncateMessageContent(messages[0], available)];
      }
    }
    return messages;
  }

  let trimmed = [...messages];
  // Always keep the last message (current user input).
  while (
    trimmed.length > 1 &&
    estimateRequestTokens(system, trimmed) > maxInputTokens
  ) {
    trimmed = trimmed.slice(1);
  }

  // After trimming history, check if the last message itself is too large
  if (trimmed.length === 1) {
    const msgTokens = estimateMessageTokens(trimmed[0]);
    const systemTokens = estimateTokensFromText(system);
    const available = maxInputTokens - systemTokens - 500;

    if (msgTokens > available) {
      logger.warn(
        `Last message too large after trim (${msgTokens} tokens), truncating to fit ${available} tokens`,
      );
      return [truncateMessageContent(trimmed[0], available)];
    }
  }

  return trimmed;
}

// Summarization constants
// Trigger at 80% - enough headroom for large context models (100k+ have 20k+ buffer)
const SUMMARY_TRIGGER_THRESHOLD = 0.8;
const MESSAGES_TO_KEEP_RECENT = 10; // Always keep last N messages in full
// Keep summaries short; we want a compact "memory" style, not a transcript.
const SUMMARY_TARGET_TOKENS = 900;
const SUMMARY_TEMPERATURE = 0;

// Summarization mode - determines which prompt to use
type SummarizationMode = "roleplay" | "general";

function buildSummaryPrompt(
  conversationText: string,
  existingSummary: string | undefined,
  mode: SummarizationMode,
): string {
  const targetWords = mode === "roleplay" ? "250-400 words" : "200-350 words";

  const format =
    mode === "roleplay"
      ? `Return a compact roleplay memory with these sections:
1) Cast (who is who, relationships)
2) Current situation (what just happened)
3) Facts / rules established (constraints, world rules)
4) Open threads (unresolved goals/conflicts)
Keep it under ${targetWords}.`
      : `Return a compact working summary with these sections:
1) Goal / request
2) Decisions made
3) Work done (what changed)
4) Open issues / next steps
Keep it under ${targetWords}.`;

  if (existingSummary) {
    return `You are updating an existing conversation summary.

${format}

PREVIOUS SUMMARY:
${existingSummary}

NEW MESSAGES TO INCORPORATE:
${conversationText}

Update the summary. Be concise. Do not include raw transcripts.`;
  }

  return `You are summarizing a conversation for memory and context management.

${format}

CONVERSATION:
${conversationText}

Write the summary now. Be concise. Do not include raw transcripts.`;
}

async function summarizeMessages(
  model: ReturnType<typeof customModelProvider.getModel>,
  messagesToSummarize: Message[],
  existingSummary: string | undefined,
  mode: SummarizationMode,
): Promise<string> {
  const conversationText = messagesToSummarize
    .map((m) => `${m.role}: ${JSON.stringify(m.content)}`)
    .join("\n\n");

  const prompt = buildSummaryPrompt(conversationText, existingSummary, mode);

  const result = await generateText({
    model,
    prompt,
    maxTokens: SUMMARY_TARGET_TOKENS,
    temperature: SUMMARY_TEMPERATURE,
  });

  logger.info("=== SUMMARY GENERATION ===");
  logger.info(`Mode: ${mode}`);
  logger.info(`Input Messages Count: ${messagesToSummarize.length}`);
  logger.info(`Generated Summary:\n${result.text}`);
  logger.info("==========================");

  return result.text;
}

interface SummarizationResult {
  messages: Message[];
  summaryCreated: boolean;
  summaryMessage?: ChatMessage;
  summarizedMessageIds?: string[];
  lastMessageTruncated?: boolean;
}

async function handleContextSummarization(
  model: ReturnType<typeof customModelProvider.getModel>,
  systemPrompt: string,
  allMessages: Message[],
  dbMessages: ChatMessage[],
  maxInputTokens: number,
  threadId: string,
  dataStream: any,
  mode: SummarizationMode,
  debugContext?: {
    maxContextTokens?: number;
    maxOutputTokens?: number;
    maxInputTokens?: number;
    modelKey?: string;
  },
): Promise<SummarizationResult> {
  const systemTokens = estimateTokensFromText(systemPrompt);

  // If a summary exists, we prioritize it and only send the summary + messages that follow it.
  // This simulates deletion from the model's perspective without actually deleting from DB.
  let effectiveMessages = allMessages;
  const existingSummaryIdxInDb = dbMessages.findIndex((m) => m.isSummary);

  if (existingSummaryIdxInDb >= 0) {
    const summaryMsgId = dbMessages[existingSummaryIdxInDb].id;
    const summaryIdxInAll = allMessages.findIndex((m) => m.id === summaryMsgId);
    if (summaryIdxInAll >= 0) {
      effectiveMessages = allMessages.slice(summaryIdxInAll);
    }
  }

  const currentTokens = estimateRequestTokens(systemPrompt, effectiveMessages);
  const threshold = maxInputTokens * SUMMARY_TRIGGER_THRESHOLD;

  logger.info(
    `Context check: ${currentTokens} tokens, threshold: ${threshold}, max: ${maxInputTokens}, messages: ${effectiveMessages.length} (total: ${allMessages.length})`,
  );

  // EDGE CASE 1: Single huge message that exceeds limit by itself
  // Example: old=0, new=25k, limit=20k → truncate the new message
  if (effectiveMessages.length === 1) {
    const msgTokens = estimateMessageTokens(effectiveMessages[0]);
    const available = maxInputTokens - systemTokens - 500;

    if (msgTokens > available) {
      logger.warn(
        `Single message (${msgTokens} tokens) exceeds limit (${available}), truncating`,
      );
      return {
        messages: [truncateMessageContent(effectiveMessages[0], available)],
        summaryCreated: false,
        lastMessageTruncated: true,
      };
    }
    return { messages: effectiveMessages, summaryCreated: false };
  }

  // EDGE CASE 2: Last message alone is huge (old=5k, new=25k, limit=20k)
  // → We must truncate the last message, can't just summarize old stuff
  const lastMessage = effectiveMessages[effectiveMessages.length - 1];
  const lastMsgTokens = estimateMessageTokens(lastMessage);
  const availableForLastMsg = maxInputTokens - systemTokens - 2000; // Reserve 2k for summary

  if (lastMsgTokens > availableForLastMsg) {
    logger.warn(
      `Last message alone (${lastMsgTokens} tokens) exceeds available space (${availableForLastMsg}), truncating it`,
    );

    // Truncate last message, summarize old ones
    const truncatedLast = truncateMessageContent(
      lastMessage,
      availableForLastMsg,
    );
    const olderMessages = effectiveMessages.slice(0, -1);

    // If there are older messages, summarize them
    if (olderMessages.length > 0) {
      const existingSummaryIdx = dbMessages.findIndex((m) => m.isSummary);
      const existingSummary =
        existingSummaryIdx >= 0 ? dbMessages[existingSummaryIdx] : null;
      const existingSummaryText = existingSummary
        ? ((existingSummary.parts?.[0] as any)?.text || "").replace(
            /^\[CONVERSATION SUMMARY\]\s*/,
            "",
          )
        : undefined;

      const summaryText = await summarizeMessages(
        model,
        olderMessages,
        existingSummaryText,
        mode,
      );

      const summaryMessageId = `summary-${threadId}-${Date.now()}`;
      const summarizedMessageIds = dbMessages
        .filter((m) => !m.isSummary)
        .slice(0, -1)
        .map((m) => m.id);

      // Calculate timestamp: place summary RIGHT BEFORE the last message
      const lastMsg = dbMessages.filter((m) => !m.isSummary).slice(-1)[0];
      const summaryTimestamp = lastMsg
        ? new Date(lastMsg.createdAt.getTime() - 1000) // 1s before last message (safer ordering)
        : new Date();

      const summaryMessage: ChatMessage = {
        id: summaryMessageId,
        threadId,
        role: "assistant",
        parts: [
          { type: "text", text: `[CONVERSATION SUMMARY]\n${summaryText}` },
        ],
        model: null,
        createdAt: summaryTimestamp,
        isSummary: true,
        summarizedMessageIds,
        summarizedAt: new Date(),
        annotations: [
          {
            isSummaryBadge: true,
            summarizedCount: summarizedMessageIds.length,
            summarizedTokens: estimateTokensFromText(
              olderMessages.map((m) => JSON.stringify(m.content)).join(""),
            ),
            debug: {
              summaryMode: mode,
              model: debugContext?.modelKey,
              maxContextTokens: debugContext?.maxContextTokens,
              maxOutputTokens: debugContext?.maxOutputTokens,
              maxInputTokens: debugContext?.maxInputTokens ?? maxInputTokens,
              triggerThreshold: threshold,
              currentTokensAtTrigger: currentTokens,
              keptRecentMessages: 1,
              summaryTargetTokens: SUMMARY_TARGET_TOKENS,
              summaryTemperature: SUMMARY_TEMPERATURE,
            },
          },
        ],
      };

      const summaryAsMessage: Message = {
        id: summaryMessageId,
        role: "system",
        content: `[CONVERSATION SUMMARY]\n${summaryText}`,
      };

      return {
        messages: [summaryAsMessage, truncatedLast],
        summaryCreated: true,
        summaryMessage,
        summarizedMessageIds,
        lastMessageTruncated: true,
      };
    }

    return {
      messages: [truncatedLast],
      summaryCreated: false,
      lastMessageTruncated: true,
    };
  }

  // Normal case: Check if we need summarization based on threshold
  if (currentTokens < threshold) {
    return { messages: effectiveMessages, summaryCreated: false };
  }

  // Determine how many recent messages to keep (usually 10, but less if they are huge)
  // We MUST keep at least 1 message, but we try to keep up to 10.
  let recentCount = Math.max(
    1,
    Math.min(MESSAGES_TO_KEEP_RECENT, effectiveMessages.length - 1),
  );

  // If we have so many tokens that even keeping that many messages might be too much,
  // we reduce the "recent" count to force more into the summary.
  if (currentTokens > maxInputTokens * 0.9) {
    recentCount = Math.max(
      1,
      Math.min(recentCount, Math.floor(MESSAGES_TO_KEEP_RECENT / 2)),
    );
  }

  if (effectiveMessages.length <= 1) {
    logger.info(
      `Context above threshold (${currentTokens} > ${threshold}) but only ${effectiveMessages.length} messages, skipping summary`,
    );
    return { messages: effectiveMessages, summaryCreated: false };
  }

  logger.info(
    `Context summarization triggered: ${currentTokens} tokens exceeds ${threshold} threshold (keeping ${recentCount} recent messages)`,
  );

  // Emit "pending" signal to show loading spinner in UI (use writeData so it appears in useChat's data property)
  dataStream.writeData({
    type: "summary-pending",
  });

  // Find existing summary message
  const existingSummaryIdx = dbMessages.findIndex((m) => m.isSummary);
  const existingSummary =
    existingSummaryIdx >= 0 ? dbMessages[existingSummaryIdx] : null;

  // Determine messages to summarize (everything before the recent ones)
  const recentMessages = effectiveMessages.slice(-recentCount);
  const olderMessages = effectiveMessages.slice(0, -recentCount);

  // Get existing summary text if present
  const existingSummaryText = existingSummary
    ? ((existingSummary.parts?.[0] as any)?.text || "").replace(
        /^\[CONVERSATION SUMMARY\]\s*/,
        "",
      )
    : undefined;

  // Generate new summary - wrap in try-catch to handle failures
  let summaryText: string;
  try {
    summaryText = await summarizeMessages(
      model,
      olderMessages,
      existingSummaryText,
      mode,
    );
  } catch (error) {
    logger.error("Summary generation failed:", error);
    // Emit failure signal so UI can show error and allow retry
    dataStream.writeData({
      type: "summary-failed",
      error:
        error instanceof Error ? error.message : "Summary generation failed",
    });
    // Fallback to simple trimming
    return {
      messages: trimMessagesToFit("", effectiveMessages, maxInputTokens),
      summaryCreated: false,
    };
  }

  // Create summary message for DB (use "assistant" role so it shows in UI)
  const summaryMessageId = `summary-${threadId}-${Date.now()}`;
  const summarizedMessageIds = dbMessages
    .filter((m) => !m.isSummary)
    .slice(0, -recentCount)
    .map((m) => m.id);

  // Calculate timestamp: place summary RIGHT BEFORE the first recent message
  // This ensures correct ordering when messages are sorted by createdAt
  const firstRecentMsg = dbMessages
    .filter((m) => !m.isSummary)
    .slice(-recentCount)[0];
  const summaryTimestamp = firstRecentMsg
    ? new Date(firstRecentMsg.createdAt.getTime() - 1000) // 1s before first recent (safer ordering)
    : new Date();

  const summaryMessage: ChatMessage = {
    id: summaryMessageId,
    threadId,
    role: "assistant", // Use assistant so it appears in chat UI
    parts: [{ type: "text", text: `[CONVERSATION SUMMARY]\n${summaryText}` }],
    model: null,
    createdAt: summaryTimestamp,
    isSummary: true,
    summarizedMessageIds,
    summarizedAt: new Date(),
    annotations: [
      {
        isSummaryBadge: true,
        summarizedCount: summarizedMessageIds.length,
        summarizedTokens: estimateTokensFromText(
          olderMessages.map((m) => JSON.stringify(m.content)).join(""),
        ),
        debug: {
          summaryMode: mode,
          model: debugContext?.modelKey,
          maxContextTokens: debugContext?.maxContextTokens,
          maxOutputTokens: debugContext?.maxOutputTokens,
          maxInputTokens: debugContext?.maxInputTokens ?? maxInputTokens,
          triggerThreshold: threshold,
          currentTokensAtTrigger: currentTokens,
          keptRecentMessages: recentCount,
          summaryTargetTokens: SUMMARY_TARGET_TOKENS,
          summaryTemperature: SUMMARY_TEMPERATURE,
        },
      },
    ],
  };

  // Create the message array for the LLM: summary (as system) + recent messages
  const summaryAsMessage: Message = {
    id: summaryMessageId,
    role: "system", // Use system for LLM so it treats as context, not conversation
    content: `[CONVERSATION SUMMARY]\n${summaryText}`,
  };

  const messagesForLLM = [summaryAsMessage, ...recentMessages];

  logger.info(
    `Created summary: ${summarizedMessageIds.length} messages -> ~${estimateTokensFromText(summaryText)} tokens`,
  );

  return {
    messages: messagesForLLM,
    summaryCreated: true,
    summaryMessage,
    summarizedMessageIds,
  };
}

/**
 * Handle simulated tool calling for models that output XML-style tool calls
 * This parses tool calls from text, executes them, and continues the conversation
 */
async function handleSimulatedToolStream(options: {
  model: ReturnType<typeof customModelProvider.getModel>;
  systemPrompt: string;
  messages: Message[];
  maxTokens: number;
  tools: Record<string, any>;
  dataStream: any;
  abortSignal?: AbortSignal;
  advancedEnabled?: boolean;
  advanced?: { temperature?: number; topP?: number; topK?: number };
  onSaveMessages: (assistantText: string) => Promise<void>;
}) {
  const {
    model,
    systemPrompt,
    messages,
    maxTokens,
    tools,
    dataStream,
    abortSignal,
    advancedEnabled,
    advanced,
    onSaveMessages,
  } = options;

  const conversationMessages = [...messages];
  let fullAssistantResponse = "";
  let iteration = 0;
  const MAX_ITERATIONS = 10; // Safety limit

  // DEBUG: Log the messages being sent to the model
  logger.info(
    `[SimulatedTools] Starting with ${messages.length} messages in history`,
  );
  messages.forEach((m, i) => {
    const content =
      typeof m.content === "string"
        ? m.content.slice(0, 100)
        : JSON.stringify(m.parts?.[0]).slice(0, 100);
    logger.info(
      `[SimulatedTools] Message ${i}: role=${m.role}, content=${content}...`,
    );
  });

  let hadToolCallInPreviousIteration = false;

  while (iteration < MAX_ITERATIONS) {
    iteration++;

    // If previous iteration had a tool call, signal a NEW message
    // This ensures continuation text appears in a SEPARATE message bubble
    if (hadToolCallInPreviousIteration) {
      dataStream.write(
        formatDataStreamPart("start_step", {
          messageId: `simulated_continuation_${Date.now()}`,
        }),
      );
    }

    let currentResponseText = ""; // Will be set after processing
    const toolCallHolder: {
      value: { name: string; arguments: Record<string, unknown> } | null;
    } = { value: null };

    // Stream text from model
    const result = streamText({
      model,
      system: systemPrompt,
      messages: conversationMessages,
      maxTokens,
      experimental_transform: smoothStream({ chunking: "word" }),
      maxRetries: 2,
      ...(advancedEnabled && typeof advanced?.temperature === "number"
        ? { temperature: advanced.temperature }
        : {}),
      ...(advancedEnabled && typeof advanced?.topP === "number"
        ? { topP: advanced.topP }
        : {}),
      ...(advancedEnabled && typeof advanced?.topK === "number"
        ? { topK: advanced.topK }
        : {}),
      abortSignal,
    });

    // Track text that comes before and after tool call
    let textBeforeToolCall = "";
    let toolCallDetected = false;

    // Process stream with buffering for tool detection
    const buffer = new SimulatedToolBuffer(
      // On text - buffer it, don't write yet (we need to handle ordering)
      (text) => {
        if (!toolCallDetected) {
          textBeforeToolCall += text;
        }
        // Text after tool call will be in next iteration
      },
      // On tool call - capture it and mark as detected
      (toolCall) => {
        logger.info(`[SimulatedTools] Detected tool call: ${toolCall.name}`);
        toolCallHolder.value = toolCall;
        toolCallDetected = true;
      },
    );

    // Consume the stream
    for await (const chunk of result.textStream) {
      buffer.process(chunk);

      // If tool detected mid-stream, stop processing more chunks
      if (toolCallHolder.value) {
        break;
      }
    }
    buffer.finish();

    // Now write the text that came BEFORE the tool call (or all text if no tool)
    if (textBeforeToolCall) {
      dataStream.write(formatDataStreamPart("text", textBeforeToolCall));
      currentResponseText = textBeforeToolCall;
    }

    // Add current response to full response
    fullAssistantResponse += currentResponseText;

    // If a tool was detected, execute it and continue
    const detectedToolCall = toolCallHolder.value;
    if (detectedToolCall) {
      const toolName = detectedToolCall.name;
      const toolArgs = detectedToolCall.arguments;

      logger.info(`[SimulatedTools] Executing tool: ${toolName}`, toolArgs);

      // Write tool invocation to stream (for UI display)
      const toolCallId = `simulated_${Date.now()}_${toolName}`;
      dataStream.write(
        formatDataStreamPart("tool_call", {
          toolCallId,
          toolName,
          args: toolArgs,
        }),
      );

      // Execute the tool
      let toolResult: unknown;
      let toolError: string | undefined;

      try {
        const tool = tools[toolName];
        if (tool?.execute) {
          toolResult = await tool.execute(toolArgs, {
            toolCallId,
            messages: conversationMessages,
            abortSignal,
          });
        } else {
          toolError = `Tool '${toolName}' not found or not executable`;
        }
      } catch (error: any) {
        toolError = error.message || String(error);
        logger.error(`[SimulatedTools] Tool error:`, error);
      }

      // Write tool result to stream
      dataStream.write(
        formatDataStreamPart("tool_result", {
          toolCallId,
          result: toolError ? { error: toolError } : toolResult,
        }),
      );

      // Signal step complete AND message complete
      // The next iteration will start a NEW message for the continuation text
      dataStream.write(
        formatDataStreamPart("finish_step", {
          isContinued: false, // This message is complete
          finishReason: "tool-calls",
        }),
      );
      dataStream.write(
        formatDataStreamPart("finish_message", {
          finishReason: "tool-calls",
        }),
      );

      // Add assistant's text (up to tool call) and tool result to conversation
      if (currentResponseText.trim()) {
        conversationMessages.push({
          id: `assistant_${Date.now()}`,
          role: "assistant",
          content: currentResponseText,
        });
      }

      // Add tool result as a message for the model to see
      const toolResultText = toolError
        ? `Tool '${toolName}' failed: ${toolError}`
        : `Tool '${toolName}' result:\n${JSON.stringify(toolResult, null, 2)}`;

      conversationMessages.push({
        id: `tool_result_${Date.now()}`,
        role: "user", // Use user role so model sees the result
        content: `<tool_result>${toolResultText}</tool_result>\n\nPlease continue based on this tool result.`,
      });

      // Mark that we had a tool call - next iteration will start a new message
      hadToolCallInPreviousIteration = true;

      // Continue to next iteration for model to process tool result
      continue;
    }

    // No tool call detected - we're done
    break;
  }

  // Save the messages
  await onSaveMessages(fullAssistantResponse);

  logger.info(`[SimulatedTools] Completed with ${iteration} iteration(s)`);
}

export async function POST(request: Request) {
  try {
    const json = await request.json();

    let session = await getSession();

    // Handle Offline Mode
    if (!session?.user?.id) {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      const offlineToken = cookieStore.get("diffchat_offline_token")?.value;
      const offlineUserStr = cookieStore.get("diffchat_offline_user")?.value;

      if (offlineToken && offlineUserStr) {
        try {
          const user = JSON.parse(offlineUserStr);
          // Create a synthetic session object that matches the structure expected by the app
          session = {
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              image: user.image,
              emailVerified: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            session: {
              id: "offline-session",
              userId: user.id,
              token: offlineToken,
              expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
              createdAt: new Date(),
              updatedAt: new Date(),
              ipAddress: "127.0.0.1",
              userAgent: "Offline-Mode",
            },
          };
        } catch (e) {
          console.error("Failed to parse offline user cookie in chat API", e);
        }
      }
    }

    if (!session?.user.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const {
      id,
      message,
      chatModel,
      toolChoice,
      allowedAppDefaultToolkit,
      allowedMcpServers,
      thinking,
      autoSummary = true,
      mentions = [],
    } = chatApiSchemaRequestBodySchema.parse(json);

    const preferences = await userRepository.getPreferences(session.user.id);
    const apiKeys = preferences?.apiKeys;

    const generation = preferences?.generation;
    const maxContextTokensDefault =
      generation?.maxContextTokensDefault ?? 60000;
    const modelKey = `${chatModel?.provider ?? ""}:${chatModel?.model ?? ""}`;
    const maxContextTokens =
      generation?.maxContextTokensByModel?.[modelKey] ??
      maxContextTokensDefault;
    const advanced = generation?.advanced;
    const advancedEnabled = Boolean(advanced?.enabled);

    logger.info(
      `apiKeys available for providers: ${apiKeys ? Object.keys(apiKeys).join(", ") : "none"}`,
    );

    const model = customModelProvider.getModel(chatModel, apiKeys);

    let thread = await chatRepository.selectThreadDetails(id);

    if (!thread) {
      logger.info(`create chat thread: ${id}`);
      const newThread = await chatRepository.insertThread({
        id,
        title: "",
        userId: session.user.id,
      });
      thread = await chatRepository.selectThreadDetails(newThread.id);
    }

    if (thread!.userId !== session.user.id) {
      return new Response("Forbidden", { status: 403 });
    }

    // if is false, it means the last message is manual tool execution
    const isLastMessageUserMessage = message.role == "user";

    const previousMessages = (thread?.messages ?? []).map(convertToMessage);

    // DEBUG: Log loaded messages
    logger.info(
      `[History] thread.messages count: ${thread?.messages?.length ?? 0}`,
    );
    thread?.messages?.forEach((m, i) => {
      logger.info(
        `[History] DB Message ${i}: role=${m.role}, parts=${m.parts?.length}, content preview=${m.parts?.[0]?.type}`,
      );
    });

    const messages: Message[] = isLastMessageUserMessage
      ? appendClientMessage({
          messages: previousMessages,
          message,
        })
      : previousMessages;

    const inProgressToolStep = extractInProgressToolPart(messages.slice(-2));

    const supportToolCall = !isToolCallUnsupportedModel(model);
    const useSimulatedTools = isSimulatedToolModel(model);

    const agentId = mentions.find((m) => m.type === "agent")?.agentId;

    const agent = await rememberAgentAction(agentId, session.user.id);

    if (agent?.instructions?.mentions) {
      mentions.push(...agent.instructions.mentions);
    }

    // For simulated tools, we allow tool calls but handle them differently
    const isToolCallAllowed =
      (supportToolCall || useSimulatedTools) &&
      (toolChoice != "none" || mentions.length > 0);

    return createDataStreamResponse({
      execute: async (dataStream) => {
        const mcpClients = await mcpClientsManager.getClients();
        logger.info(`mcp-server count: ${mcpClients.length}`);

        const MCP_TOOLS = await safe()
          .map(errorIf(() => !isToolCallAllowed && "Not allowed"))
          .map(() =>
            loadMcpTools({
              mentions,
              allowedMcpServers,
            }),
          )
          .orElse({});

        const WORKFLOW_TOOLS = await safe()
          .map(errorIf(() => !isToolCallAllowed && "Not allowed"))
          .map(() =>
            loadWorkFlowTools({
              mentions,
              dataStream,
            }),
          )
          .orElse({});

        const APP_DEFAULT_TOOLS = await safe()
          .map(errorIf(() => !isToolCallAllowed && "Not allowed"))
          .map(() =>
            loadAppDefaultTools({
              mentions,
              allowedAppDefaultToolkit,
            }),
          )
          .orElse({});

        if (inProgressToolStep) {
          const toolResult = await manualToolExecuteByLastMessage(
            inProgressToolStep,
            message,
            { ...MCP_TOOLS, ...WORKFLOW_TOOLS, ...APP_DEFAULT_TOOLS },
            request.signal,
          );
          assignToolResult(inProgressToolStep, toolResult);
          dataStream.write(
            formatDataStreamPart("tool_result", {
              toolCallId: inProgressToolStep.toolInvocation.toolCallId,
              result: toolResult,
            }),
          );
        }

        const userPreferences = thread?.userPreferences || undefined;

        const mcpServerCustomizations = await safe()
          .map(() => {
            if (Object.keys(MCP_TOOLS ?? {}).length === 0)
              throw new Error("No tools found");
            return rememberMcpServerCustomizationsAction(session.user.id);
          })
          .map((v) => filterMcpServerCustomizations(MCP_TOOLS!, v))
          .orElse({});

        // ═══════════════════════════════════════════════════════════════════
        // CHARACTER/ROLEPLAY MODE DETECTION
        // If thread has characterId, use roleplay system prompt instead
        // ═══════════════════════════════════════════════════════════════════
        let baseSystemPrompt: string;

        if (thread?.characterId) {
          // CHARACTER MODE: Load character from separate character table
          const character =
            (await characterRepository.findPublicById(thread.characterId)) ||
            (await characterRepository.findByIdForUser(
              thread.characterId,
              session.user.id,
            ));

          if (!character) {
            throw new Error("Character not found");
          }

          // Load persona (from thread or user's default)
          const persona = thread.personaId
            ? await personaRepository.findById(
                thread.personaId,
                session.user.id,
              )
            : await personaRepository.findDefault(session.user.id);

          // Load style (from thread or user's default)
          const style = thread.stylePresetId
            ? await stylePresetRepository.findById(
                thread.stylePresetId,
                session.user.id,
              )
            : await stylePresetRepository.findDefault(session.user.id);

          baseSystemPrompt = buildRoleplaySystemPrompt({
            character,
            persona: persona || undefined,
            style: style || undefined,
          });

          logger.info(
            `character mode: ${character.name}, persona: ${persona?.name || "none"}, style: ${style?.name || "none"}`,
          );
        } else {
          // NORMAL/AGENT MODE: Use existing system prompt builder
          baseSystemPrompt = buildUserSystemPrompt(
            session.user,
            userPreferences,
            agent,
          );
        }

        // Build tool set first (needed for both native and simulated)
        const allTools = safe({ ...MCP_TOOLS, ...WORKFLOW_TOOLS })
          .map((t) => {
            const bindingTools =
              toolChoice === "manual" ? excludeToolExecution(t) : t;
            return {
              ...bindingTools,
              ...APP_DEFAULT_TOOLS, // APP_DEFAULT_TOOLS Not Supported Manual
            };
          })
          .map((t) => {
            if (supportToolCall && thinking) {
              return {
                ...t,
                [SequentialThinkingToolName]: sequentialThinkingTool,
              };
            }
            return t;
          })
          .unwrap();

        // For simulated tools, inject tool schemas into system prompt
        const simulatedToolSchemaPrompt = useSimulatedTools
          ? generateToolSchemaPrompt(allTools)
          : "";

        const systemPrompt = mergeSystemPrompt(
          baseSystemPrompt,
          buildMcpServerCustomizationsSystemPrompt(mcpServerCustomizations),
          !supportToolCall &&
            !useSimulatedTools &&
            buildToolCallUnsupportedModelSystemPrompt,
          (!supportToolCall ||
            ["openai", "anthropic"].includes(chatModel?.provider ?? "")) &&
            thinking &&
            buildThinkingSystemPrompt(supportToolCall),
          simulatedToolSchemaPrompt,
        );

        // For native tool calls, use the tools directly
        // For simulated tools, we don't pass tools to streamText (model outputs XML text)
        const vercelAITooles = useSimulatedTools ? {} : allTools;

        const allowedMcpTools = Object.values(allowedMcpServers ?? {})
          .map((t) => t.tools)
          .flat();

        logger.info(
          `${agent ? `agent: ${agent.name}, ` : ""}tool mode: ${toolChoice}, mentions: ${mentions.length}, allowedMcpTools: ${allowedMcpTools.length} thinking: ${thinking}`,
        );
        logger.info(
          `binding tool count APP_DEFAULT: ${Object.keys(APP_DEFAULT_TOOLS ?? {}).length}, MCP: ${Object.keys(MCP_TOOLS ?? {}).length}, Workflow: ${Object.keys(WORKFLOW_TOOLS ?? {}).length}`,
        );
        logger.info(`model: ${chatModel?.provider}/${chatModel?.model}`);

        // IMPORTANT: Always cap completion tokens.
        // Also: trim message history so total request stays within the configured context cap.
        const fallbackMaxOutputTokens =
          chatModel?.provider === "nvidia" ? 8192 : 4096;
        const configuredMaxOutputTokens = advancedEnabled
          ? advanced?.maxOutputTokens
          : undefined;

        const maxTokens = Math.max(
          128,
          Math.min(
            configuredMaxOutputTokens ?? fallbackMaxOutputTokens,
            // keep some room for the prompt; avoid asking for the entire window
            Math.max(128, maxContextTokens - 1024),
          ),
        );

        const maxInputTokens = Math.max(1024, maxContextTokens - maxTokens);

        // Handle context management: summarization OR simple trimming
        const dbMessages = thread?.messages ?? [];
        let finalMessages: Message[];
        let summaryCreated = false;

        if (autoSummary) {
          // Determine summarization mode based on chat type
          const summarizationMode: SummarizationMode = thread?.characterId
            ? "roleplay"
            : "general";

          // Auto-summary enabled: try to summarize when context fills
          const summarization = await handleContextSummarization(
            model,
            systemPrompt,
            messages,
            dbMessages,
            maxInputTokens,
            thread!.id,
            dataStream,
            summarizationMode,
            {
              maxContextTokens,
              maxOutputTokens: maxTokens,
              maxInputTokens,
              modelKey:
                chatModel?.provider && chatModel?.model
                  ? `${chatModel.provider}/${chatModel.model}`
                  : undefined,
            },
          );

          // If summary was created, save it to DB and notify client
          if (summarization.summaryCreated && summarization.summaryMessage) {
            // Delete old summary if exists
            const oldSummary = dbMessages.find((m) => m.isSummary);
            if (oldSummary) {
              await chatRepository.deleteChatMessage(oldSummary.id);
            }

            // Insert new summary
            await chatRepository.upsertMessage(summarization.summaryMessage);

            // Send summary signal to client for UI badge (use writeData so it appears in useChat's data property)
            dataStream.writeData({
              type: "summary-created",
              summarizedCount: summarization.summarizedMessageIds?.length ?? 0,
              summaryMessageId: summarization.summaryMessage.id,
            });

            logger.info(
              `Summary saved: ${summarization.summarizedMessageIds?.length} messages summarized`,
            );
          }

          const summarizedMessages = summarization.summaryCreated
            ? summarization.messages
            : trimMessagesToFit(systemPrompt, messages, maxInputTokens);
          summaryCreated = summarization.summaryCreated;

          // Safety net: if still over budget, trim again
          finalMessages =
            estimateRequestTokens(systemPrompt, summarizedMessages) >
            maxInputTokens
              ? trimMessagesToFit(
                  systemPrompt,
                  summarizedMessages,
                  maxInputTokens,
                )
              : summarizedMessages;
        } else {
          // Auto-summary disabled: just trim old messages (they're still in DB)
          finalMessages = trimMessagesToFit(
            systemPrompt,
            messages,
            maxInputTokens,
          );
          logger.info(`Auto-summary disabled, using simple trim`);
        }

        logger.info(
          `context cap: ${maxContextTokens} (input budget: ${maxInputTokens}, maxTokens: ${maxTokens}, estTokens: ${estimateRequestTokens(systemPrompt, finalMessages)}, summarized: ${summaryCreated}, autoSummary: ${autoSummary})`,
        );

        // Simulated tools mode: parse XML tool calls from text output
        if (useSimulatedTools && Object.keys(allTools).length > 0) {
          logger.info(
            `Using simulated tool mode for ${chatModel?.provider}/${chatModel?.model}`,
          );

          await handleSimulatedToolStream({
            model,
            systemPrompt,
            messages: finalMessages,
            maxTokens,
            tools: allTools,
            dataStream,
            abortSignal: request.signal,
            advancedEnabled,
            advanced,
            onSaveMessages: async (assistantText: string) => {
              // Save the final assistant message
              if (isLastMessageUserMessage) {
                await chatRepository.upsertMessage({
                  threadId: thread!.id,
                  model: chatModel?.model ?? null,
                  role: "user",
                  parts: message.parts,
                  attachments: message.experimental_attachments,
                  id: message.id,
                  annotations: message.annotations,
                });
              }
              if (assistantText) {
                const assistantId = `assistant_${Date.now()}`;
                await chatRepository.upsertMessage({
                  model: chatModel?.model ?? null,
                  threadId: thread!.id,
                  role: "assistant",
                  id: assistantId,
                  parts: [{ type: "text", text: assistantText }],
                  annotations: [{ toolChoice }],
                });
              }
              if (agent) {
                await agentRepository.updateAgent(agent.id, session.user.id, {
                  updatedAt: new Date(),
                } as any);
              }
            },
          });
          return;
        }

        const result = streamText({
          model,
          system: systemPrompt,
          messages: finalMessages,
          maxTokens,
          maxSteps: 10,
          toolCallStreaming: true,
          experimental_transform: smoothStream({ chunking: "word" }),
          maxRetries: 2,
          ...(advancedEnabled && typeof advanced?.temperature === "number"
            ? { temperature: advanced.temperature }
            : {}),
          ...(advancedEnabled && typeof advanced?.topP === "number"
            ? { topP: advanced.topP }
            : {}),
          ...(advancedEnabled && typeof advanced?.topK === "number"
            ? { topK: advanced.topK }
            : {}),
          tools: vercelAITooles,
          toolChoice: "auto",
          abortSignal: request.signal,
          onFinish: async ({ response, usage }) => {
            const appendMessages = appendResponseMessages({
              messages: messages.slice(-1),
              responseMessages: response.messages,
            });
            if (isLastMessageUserMessage) {
              await chatRepository.upsertMessage({
                threadId: thread!.id,
                model: chatModel?.model ?? null,
                role: "user",
                parts: message.parts,
                attachments: message.experimental_attachments,
                id: message.id,
                annotations: appendAnnotations(message.annotations, {
                  usageTokens: usage.promptTokens,
                }),
              });
            }
            const assistantMessage = appendMessages.at(-1);
            if (assistantMessage) {
              const annotations = appendAnnotations(
                assistantMessage.annotations,
                {
                  usageTokens: usage.completionTokens,
                  toolChoice,
                },
              );
              dataStream.writeMessageAnnotation(annotations.at(-1)!);
              chatRepository.upsertMessage({
                model: chatModel?.model ?? null,
                threadId: thread!.id,
                role: assistantMessage.role,
                id: assistantMessage.id,
                parts: (assistantMessage.parts as UIMessage["parts"]).map(
                  (v) => {
                    if (
                      v.type == "tool-invocation" &&
                      v.toolInvocation.state == "result" &&
                      isVercelAIWorkflowTool(v.toolInvocation.result)
                    ) {
                      return {
                        ...v,
                        toolInvocation: {
                          ...v.toolInvocation,
                          result: {
                            ...v.toolInvocation.result,
                            history: v.toolInvocation.result.history.map(
                              (h) => {
                                return {
                                  ...h,
                                  result: undefined,
                                };
                              },
                            ),
                          },
                        },
                      };
                    }
                    if (
                      v.type == "tool-invocation" &&
                      v.toolInvocation.state == "result" &&
                      v.toolInvocation.toolName == SequentialThinkingToolName
                    ) {
                      return {
                        ...v,
                        toolInvocation: {
                          ...v.toolInvocation,
                          args: {},
                        },
                      };
                    }
                    return v;
                  },
                ),
                attachments: assistantMessage.experimental_attachments,
                annotations,
              });
            }
            if (agent) {
              await agentRepository.updateAgent(agent.id, session.user.id, {
                updatedAt: new Date(),
              } as any);
            }
          },
        });
        result.consumeStream();
        result.mergeIntoDataStream(dataStream, {
          sendReasoning: true,
        });
        result.usage.then((useage) => {
          logger.debug(
            `usage input: ${useage.promptTokens}, usage output: ${useage.completionTokens}, usage total: ${useage.totalTokens}`,
          );
        });
      },
      onError: handleError,
    });
  } catch (error: any) {
    logger.error(error);
    return new Response(error.message, { status: 500 });
  }
}
