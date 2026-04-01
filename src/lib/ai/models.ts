// models.ts
import { createOllama } from "ollama-ai-provider";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { google } from "@ai-sdk/google";
import { anthropic, createAnthropic } from "@ai-sdk/anthropic";
import { xai, createXai } from "@ai-sdk/xai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { LanguageModel } from "ai";
import {
  createOpenAICompatibleModels,
  openaiCompatibleModelsSafeParse,
} from "./create-openai-compatiable";
import { ChatModel } from "app-types/chat";

// Model display names for UI
const modelDisplayNames: Record<string, Record<string, string>> = {
  anvil: {
    "hermes-3": "Hermes 3",
    "qwen3-30b": "Qwen 3 30B",
  },
  nvidia: {
    "deepseek-ai/deepseek-v3.1": "DeepSeek V3.1",
  },
  openai: {
    "gpt-4.1": "GPT-4.1",
    "gpt-4.1-mini": "GPT-4.1 Mini",
    "4o": "GPT-4o",
    "4o-mini": "GPT-4o Mini",
    "o4-mini": "o4-mini",
  },
  google: {
    "gemini-flash-lite-latest": "Gemini Flash Lite",
    "gemini-2.5-flash-lite": "Gemini 2.5 Flash Lite",
    "gemini-2.5-flash": "Gemini 2.5 Flash",
    "gemini-flash-latest": "Gemini 3 Flash",
  },
  anthropic: {
    "claude-4-sonnet": "Claude 4 Sonnet",
    "claude-4-opus": "Claude 4 Opus",
    "claude-3-7-sonnet": "Claude 3.7 Sonnet",
  },
  xai: {
    "grok-3": "Grok 3",
    "grok-3-mini": "Grok 3 Mini",
  },
  ollama: {
    "gemma3:1b": "Gemma 3 (1B)",
    "gemma3:4b": "Gemma 3 (4B)",
    "gemma3:12b": "Gemma 3 (12B)",
  },
  openRouter: {
    "qwen3-8b:free": "Qwen 3 8B (Free)",
    "qwen3-14b:free": "Qwen 3 14B (Free)",
  },
};

const ollama = createOllama({
  baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434/api",
});

const anvil = createOpenAICompatible({
  name: "anvil",
  baseURL: "https://hermes.ai.unturf.com/v1", // Default to Hermes, we'll override per model
  apiKey: "YOLO",
});

const anvilQwen = createOpenAICompatible({
  name: "anvil",
  baseURL: "https://qwen.ai.unturf.com/v1",
  apiKey: "YOLO",
});

const nvidia = createOpenAICompatible({
  name: "nvidia",
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: process.env.NVIDIA_API_KEY || "",
});

const staticModels = {
  anvil: {
    "hermes-3": anvil("adamo1139/Hermes-3-Llama-3.1-8B-FP8-Dynamic"),
    "qwen3-30b": anvilQwen(
      "hf.co/unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF:Q4_K_M",
    ),
  },
  nvidia: {
    "deepseek-ai/deepseek-v3.1": nvidia("deepseek-ai/deepseek-v3.1"),
  },
  openai: {
    "gpt-4.1": openai("gpt-4.1"),
    "gpt-4.1-mini": openai("gpt-4.1-mini"),
    "4o": openai("gpt-4o"),
    "4o-mini": openai("gpt-4o-mini"),
    "o4-mini": openai("o4-mini", {
      reasoningEffort: "low",
    }),
  },
  google: {
    "gemini-flash-lite-latest": google("gemini-flash-lite-latest"),
    "gemini-2.5-flash-lite": google("gemini-2.5-flash-lite"),
    "gemini-2.5-flash": google("gemini-2.5-flash"),
    "gemini-flash-latest": google("gemini-flash-latest"),
  },
  anthropic: {
    "claude-4-sonnet": anthropic("claude-4-sonnet-20250514"),
    "claude-4-opus": anthropic("claude-4-opus-20250514"),
    "claude-3-7-sonnet": anthropic("claude-3-7-sonnet-latest"),
  },
  xai: {
    "grok-3": xai("grok-3-latest"),
    "grok-3-mini": xai("grok-3-mini-latest"),
  },
  ollama: {
    "gemma3:1b": ollama("gemma3:1b"),
    "gemma3:4b": ollama("gemma3:4b"),
    "gemma3:12b": ollama("gemma3:12b"),
  },
  openRouter: {
    "qwen3-8b:free": openrouter("qwen/qwen3-8b:free"),
    "qwen3-14b:free": openrouter("qwen/qwen3-14b:free"),
  },
};

const staticUnsupportedModels = new Set([
  staticModels.openai["o4-mini"],
  // All Gemini Flash Lite models now support tools!
  staticModels.ollama["gemma3:1b"],
  staticModels.ollama["gemma3:4b"],
  staticModels.ollama["gemma3:12b"],
  staticModels.openRouter["qwen3-8b:free"],
  staticModels.openRouter["qwen3-14b:free"],
]);

// Models that use simulated/XML-style tool calls instead of native function calling
// These models output <tools>{"name": "...", "arguments": {...}}</tools> as text
const staticSimulatedToolModels = new Set([
  staticModels.anvil["hermes-3"],
  staticModels.anvil["qwen3-30b"],
]);

const openaiCompatibleProviders = openaiCompatibleModelsSafeParse(
  process.env.OPENAI_COMPATIBLE_DATA,
);

const {
  providers: openaiCompatibleModels,
  unsupportedModels: openaiCompatibleUnsupportedModels,
} = createOpenAICompatibleModels(openaiCompatibleProviders);

const allModels = { ...openaiCompatibleModels, ...staticModels };

const allUnsupportedModels = new Set([
  ...openaiCompatibleUnsupportedModels,
  ...staticUnsupportedModels,
]);

// All simulated tool models (static + any from openai-compatible config)
const allSimulatedToolModels = new Set([...staticSimulatedToolModels]);

export const isToolCallUnsupportedModel = (model: LanguageModel) => {
  return allUnsupportedModels.has(model);
};

export const isSimulatedToolModel = (model: LanguageModel) => {
  return allSimulatedToolModels.has(model);
};

const firstProvider = Object.keys(allModels)[0];
const firstModel = Object.keys(allModels[firstProvider])[0];

const fallbackModel =
  allModels["anvil"]?.["hermes-3"] ||
  allModels["nvidia"]?.["deepseek-ai/deepseek-v3.1"] ||
  allModels[firstProvider][firstModel];

export const customModelProvider = {
  modelsInfo: Object.entries(allModels).map(([provider, models]) => ({
    provider,
    models: Object.entries(models).map(([name, model]) => ({
      name,
      displayName: modelDisplayNames[provider]?.[name] || name,
      isToolCallUnsupported: isToolCallUnsupportedModel(model),
    })),
  })),
  getModel: (
    model?: ChatModel,
    apiKeys?: Record<string, string>,
  ): LanguageModel => {
    if (!model) return fallbackModel;

    console.log(
      `[getModel] provider: ${model.provider}, model: ${model.model}, hasApiKey: ${!!(apiKeys && apiKeys[model.provider])}`,
    );

    if (apiKeys && apiKeys[model.provider]) {
      const apiKey = apiKeys[model.provider];
      console.log(`[getModel] Using custom API key for ${model.provider}`);
      switch (model.provider) {
        case "openai":
          return createOpenAI({ apiKey })(model.model);
        case "google":
          // createGoogle is not exported in this version, falling back to default
          return google(model.model);
        case "anthropic":
          return createAnthropic({ apiKey })(model.model);
        case "xai":
          return createXai({ apiKey })(model.model);
        case "nvidia": {
          console.log(`[NVIDIA] Creating dynamic model: ${model.model}`);
          const nvidiaProvider = createOpenAICompatible({
            name: "nvidia",
            baseURL: "https://integrate.api.nvidia.com/v1",
            apiKey,
          });
          return nvidiaProvider(model.model);
        }
        case "anvil": {
          console.log(`[ANVIL] Creating dynamic model: ${model.model}`);
          // Determine which base URL to use based on model name
          const baseURL =
            model.model === "qwen3-30b"
              ? "https://qwen.ai.unturf.com/v1"
              : "https://hermes.ai.unturf.com/v1";
          const anvilProvider = createOpenAICompatible({
            name: "anvil",
            baseURL,
            apiKey: "YOLO",
          });
          return anvilProvider(
            model.model === "hermes-3"
              ? "adamo1139/Hermes-3-Llama-3.1-8B-FP8-Dynamic"
              : model.model === "qwen3-30b"
                ? "hf.co/unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF:Q4_K_M"
                : model.model,
          );
        }
      }
    }

    console.log(
      `[getModel] Using static model for ${model.provider}/${model.model}`,
    );
    return allModels[model.provider]?.[model.model] || fallbackModel;
  },
};
