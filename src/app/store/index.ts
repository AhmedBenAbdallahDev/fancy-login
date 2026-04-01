import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { ChatMention, ChatModel, ChatThread } from "app-types/chat";
import { AllowedMCPServer, MCPServerInfo } from "app-types/mcp";
import { OPENAI_VOICE } from "lib/ai/speech/open-ai/use-voice-chat.openai";
import { WorkflowSummary } from "app-types/workflow";
import { AppDefaultToolkit } from "lib/ai/tools";
import { Agent } from "app-types/agent";
import { ArchiveWithItemCount } from "app-types/archive";

// SSR-safe storage that only uses localStorage in browser
const safeLocalStorage = {
  getItem: (name: string) => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(name);
  },
  setItem: (name: string, value: string) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(name, value);
  },
  removeItem: (name: string) => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(name);
  },
};

export interface AppState {
  threadList: ChatThread[];
  threadListOwnerId: string | null;
  mcpList: (MCPServerInfo & { id: string })[];
  agentList: Omit<Agent, "instructions">[];
  workflowToolList: WorkflowSummary[];
  currentThreadId: ChatThread["id"] | null;
  toolChoice: "auto" | "none" | "manual";
  autoSummary: boolean; // Enable auto-summarization when context limit reached
  allowedMcpServers?: Record<string, AllowedMCPServer>;
  allowedAppDefaultToolkit?: AppDefaultToolkit[];
  generatingTitleThreadIds: string[];
  archiveList: ArchiveWithItemCount[];
  threadMentions: {
    [threadId: string]: ChatMention[];
  };
  toolPresets: {
    allowedMcpServers?: Record<string, AllowedMCPServer>;
    allowedAppDefaultToolkit?: AppDefaultToolkit[];
    name: string;
  }[];
  chatModel?: ChatModel;
  openShortcutsPopup: boolean;
  openChatPreferences: boolean;
  mcpCustomizationPopup?: MCPServerInfo & { id: string };
  temporaryChat: {
    isOpen: boolean;
    instructions: string;
    chatModel?: ChatModel;
  };
  memoryExplorer: {
    isOpen: boolean;
  };
  voiceChat: {
    isOpen: boolean;
    agentId?: string;
    options: {
      provider: string;
      providerOptions?: Record<string, any>;
    };
  };
}

export interface AppDispatch {
  mutate: (state: Mutate<AppState>) => void;
}

const initialState: AppState = {
  threadList: [],
  threadListOwnerId: null,
  archiveList: [],
  generatingTitleThreadIds: [],
  threadMentions: {},
  mcpList: [],
  agentList: [],
  workflowToolList: [],
  currentThreadId: null,
  toolChoice: "auto",
  autoSummary: true, // Default: auto-summarize when context fills
  allowedMcpServers: undefined,
  // Default: enable web search and visualization tools
  allowedAppDefaultToolkit: [
    AppDefaultToolkit.WebSearch,
    AppDefaultToolkit.Visualization,
  ],
  toolPresets: [],
  openShortcutsPopup: false,
  openChatPreferences: false,
  mcpCustomizationPopup: undefined,
  temporaryChat: {
    isOpen: false,
    instructions: "",
  },
  memoryExplorer: {
    isOpen: false,
  },
  voiceChat: {
    isOpen: false,
    options: {
      provider: "openai",
      providerOptions: {
        model: OPENAI_VOICE["Alloy"],
      },
    },
  },
};

export const appStore = create<AppState & AppDispatch>()(
  persist(
    (set) => ({
      ...initialState,
      mutate: set,
    }),
    {
      name: "mc-app-store-v2.0.0",
      version: 3, // Bumped to fix empty allowedAppDefaultToolkit
      storage: createJSONStorage(() => safeLocalStorage),
      migrate: (state: any, version) => {
        if (version < 2) {
          return {
            ...state,
            threadList: [],
            threadListOwnerId: null,
          };
        }
        // Version 3: Fix empty allowedAppDefaultToolkit (was breaking tools)
        if (version < 3) {
          return {
            ...state,
            allowedAppDefaultToolkit:
              state.allowedAppDefaultToolkit?.length > 0
                ? state.allowedAppDefaultToolkit
                : [
                    AppDefaultToolkit.WebSearch,
                    AppDefaultToolkit.Visualization,
                  ],
          };
        }
        return state;
      },
      partialize: (state) => ({
        chatModel: state.chatModel || initialState.chatModel,
        toolChoice: state.toolChoice || initialState.toolChoice,
        autoSummary: state.autoSummary ?? initialState.autoSummary,
        allowedMcpServers:
          state.allowedMcpServers || initialState.allowedMcpServers,
        allowedAppDefaultToolkit: state.allowedAppDefaultToolkit?.length
          ? state.allowedAppDefaultToolkit
          : initialState.allowedAppDefaultToolkit,
        temporaryChat: {
          ...initialState.temporaryChat,
          ...state.temporaryChat,
          isOpen: false,
        },
        toolPresets: state.toolPresets || initialState.toolPresets,
        voiceChat: {
          ...initialState.voiceChat,
          ...state.voiceChat,
          isOpen: false,
        },
        threadList: state.threadList || initialState.threadList,
        threadListOwnerId:
          state.threadListOwnerId || initialState.threadListOwnerId,
        archiveList: state.archiveList || initialState.archiveList,
      }),
    },
  ),
);
