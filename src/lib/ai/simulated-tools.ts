/**
 * Simulated Tool Calling System
 *
 * This module handles models that output XML-style tool calls in text
 * instead of using native function calling APIs.
 *
 * How it works:
 * 1. Tool schemas are injected into the system prompt
 * 2. Model outputs text like <tools>{"name": "webSearch", ...}</tools>
 * 3. We parse the text stream, buffer potential tool calls, and execute them
 * 4. Tool results are fed back to the model
 *
 * This keeps the tool call text hidden from users while allowing
 * normal text (like HTML code) to pass through.
 */

import { Tool } from "ai";

// Tool call patterns we look for
const TOOL_PATTERNS = [
  "<tools>",
  "<tools ",
  "<tool_call>",
  "<tool_call ",
  "<function_call>",
  "<function_call ",
] as const;

// Maximum buffer size before we flush (safety limit)
const MAX_BUFFER_SIZE = 10000;

export interface SimulatedToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ParsedToolCall {
  toolCall: SimulatedToolCall;
  fullMatch: string;
}

/**
 * Check if a buffer could potentially be the start of a tool call pattern
 */
export function couldBeToolPattern(buffer: string): boolean {
  if (!buffer.startsWith("<")) return false;

  // Check if buffer matches the start of any pattern
  for (const pattern of TOOL_PATTERNS) {
    if (pattern.startsWith(buffer) || buffer.startsWith(pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if buffer definitely cannot be a tool pattern
 */
export function definitelyNotToolPattern(buffer: string): boolean {
  if (!buffer.startsWith("<")) return true;
  if (buffer.length < 2) return false; // Need more chars to decide

  // If we have enough chars and none of the patterns match, it's not a tool
  const bufferLower = buffer.toLowerCase();

  for (const pattern of TOOL_PATTERNS) {
    const checkLength = Math.min(buffer.length, pattern.length);
    if (
      pattern.substring(0, checkLength) ===
      bufferLower.substring(0, checkLength)
    ) {
      return false; // Could still match this pattern
    }
  }

  return true; // Doesn't match any pattern prefix
}

/**
 * Check if buffer contains a complete tool call
 */
export function isCompleteToolCall(buffer: string): boolean {
  const closingTags = ["</tools>", "</tool_call>", "</function_call>"];
  return closingTags.some((tag) => buffer.toLowerCase().includes(tag));
}

/**
 * Parse a complete tool call from text
 */
export function parseToolCall(text: string): ParsedToolCall | null {
  // Try different patterns
  const patterns = [
    /<tools[^>]*>([\s\S]*?)<\/tools>/i,
    /<tool_call[^>]*>([\s\S]*?)<\/tool_call>/i,
    /<function_call[^>]*>([\s\S]*?)<\/function_call>/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        const jsonContent = match[1].trim();
        const parsed = JSON.parse(jsonContent);

        // Handle different formats
        const toolCall: SimulatedToolCall = {
          name: parsed.name || parsed.function || parsed.tool,
          arguments: parsed.arguments || parsed.parameters || parsed.args || {},
        };

        if (toolCall.name) {
          return {
            toolCall,
            fullMatch: match[0],
          };
        }
      } catch (e) {
        console.error("[SimulatedTools] Failed to parse tool call JSON:", e);
      }
    }
  }

  return null;
}

/**
 * Streaming buffer that handles tool call detection
 */
export class SimulatedToolBuffer {
  private buffer = "";
  private isBuffering = false;
  private onText: (text: string) => void;
  private onToolCall: (toolCall: SimulatedToolCall) => void;

  constructor(
    onText: (text: string) => void,
    onToolCall: (toolCall: SimulatedToolCall) => void,
  ) {
    this.onText = onText;
    this.onToolCall = onToolCall;
  }

  /**
   * Process incoming text chunk
   */
  process(chunk: string): void {
    for (const char of chunk) {
      this.processChar(char);
    }
  }

  /**
   * Process a single character
   */
  private processChar(char: string): void {
    if (char === "<" && !this.isBuffering) {
      // Start buffering potential tool call
      this.isBuffering = true;
      this.buffer = "<";
      return;
    }

    if (this.isBuffering) {
      this.buffer += char;

      // Safety limit
      if (this.buffer.length > MAX_BUFFER_SIZE) {
        this.flush();
        return;
      }

      // Check if we can determine it's NOT a tool call
      if (this.buffer.length > 1 && definitelyNotToolPattern(this.buffer)) {
        this.flush();
        return;
      }

      // Check if we have a complete tool call
      if (isCompleteToolCall(this.buffer)) {
        const parsed = parseToolCall(this.buffer);
        if (parsed) {
          // Found a tool call - execute it (don't show to user)
          this.onToolCall(parsed.toolCall);

          // Check if there's text after the tool call
          const afterToolCall = this.buffer.substring(
            this.buffer.indexOf(parsed.fullMatch) + parsed.fullMatch.length,
          );

          this.buffer = "";
          this.isBuffering = false;

          // Process any remaining text
          if (afterToolCall) {
            this.process(afterToolCall);
          }
        } else {
          // Malformed tool call - flush as text
          this.flush();
        }
        return;
      }

      // Still could be a tool call - keep buffering
      return;
    }

    // Not buffering - output directly
    this.onText(char);
  }

  /**
   * Flush buffer to output
   */
  flush(): void {
    if (this.buffer) {
      this.onText(this.buffer);
      this.buffer = "";
    }
    this.isBuffering = false;
  }

  /**
   * Finish processing - flush any remaining buffer
   */
  finish(): void {
    this.flush();
  }
}

/**
 * Generate system prompt addition for tool schemas
 */
export function generateToolSchemaPrompt(tools: Record<string, Tool>): string {
  if (!tools || Object.keys(tools).length === 0) {
    return "";
  }

  const toolDescriptions = Object.entries(tools).map(([name, tool]) => {
    const params = tool.parameters
      ? JSON.stringify(tool.parameters, null, 2)
      : "{}";
    return `- ${name}: ${tool.description || "No description"}\n  Parameters: ${params}`;
  });

  return `
## Available Tools

You have access to the following tools. When you need to use a tool, output your request in this exact format:

<tools>{"name": "toolName", "arguments": {"param1": "value1", "param2": "value2"}}</tools>

Important rules:
1. Always use valid JSON inside the <tools> tags
2. The "name" must exactly match one of the available tools
3. The "arguments" must match the required parameters
4. Wait for the tool result before continuing
5. Do NOT show the <tools> tags to the user - they are for internal use only

Available tools:
${toolDescriptions.join("\n")}

Remember: Only use <tools> tags when you want to execute a tool. For regular text, code examples, or HTML, write normally without these tags.
`;
}

/**
 * Create a tool result message to feed back to the model
 */
export function createToolResultMessage(
  toolName: string,
  result: unknown,
): string {
  return `
<tool_result>
Tool: ${toolName}
Result: ${JSON.stringify(result, null, 2)}
</tool_result>

Please continue based on this tool result.
`;
}
