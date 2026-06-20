/**
 * workspaceStore — "造" 功能状态管理
 *
 * 管理 workspace 列表、当前活跃 workspace、SSE 流式生成状态。
 * 数据源：openclawWorkspaceApiClient
 */

import { create } from 'zustand';
import type {
  WorkspaceDTO,
  WorkspaceConversationDTO,
  WorkspaceAppDTO,
  WorkspaceAgentDTO,
} from '../../infrastructure/api/openclawWorkspaceApiClient';
import { workspaceApi } from '../../infrastructure/api/openclawWorkspaceApiClient';

export interface GenerationChunk {
  id: string;
  content: string;
  timestamp: number;
}

interface WorkspaceState {
  workspaces: WorkspaceDTO[];
  currentWorkspaceId: string | null;
  conversations: WorkspaceConversationDTO[];
  apps: WorkspaceAppDTO[];
  agents: WorkspaceAgentDTO[];
  loading: boolean;
  generating: boolean;
  generationOutput: GenerationChunk[];
  error: string | null;
  abortController: AbortController | null;

  fetchWorkspaces(): Promise<void>;
  selectWorkspace(id: string): Promise<void>;
  createWorkspace(
    name: string,
    type: WorkspaceDTO['type'],
    description?: string
  ): Promise<WorkspaceDTO>;
  createFromChat(
    channelType: string,
    conversationId: string,
    prompt: string
  ): Promise<WorkspaceDTO>;
  startGeneration(
    workspaceId: string,
    prompt: string,
    options?: { model?: string; conversationId?: string; agentId?: string }
  ): Promise<void>;
  stopGeneration(): void;
  fetchAgents(): Promise<void>;
  installSkill(workspaceId: string, skillId: string): Promise<void>;
  deployApp(workspaceId: string, appId: string): Promise<void>;
  reset(): void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  currentWorkspaceId: null,
  conversations: [],
  apps: [],
  agents: [],
  loading: false,
  generating: false,
  generationOutput: [],
  error: null,
  abortController: null,

  async fetchWorkspaces() {
    set({ loading: true, error: null });
    try {
      const { workspaces } = await workspaceApi.list();
      set({ workspaces, loading: false });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  async selectWorkspace(id: string) {
    set({ currentWorkspaceId: id, loading: true });
    try {
      const [convRes, appRes] = await Promise.all([
        workspaceApi.listConversations(id),
        workspaceApi.listApps(id),
      ]);
      set({
        conversations: convRes.conversations,
        apps: appRes.apps,
        loading: false,
      });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  async createWorkspace(name, type, description) {
    const ws = await workspaceApi.create({ name, type, description });
    set({ workspaces: [...get().workspaces, ws] });
    return ws;
  },

  async createFromChat(channelType, conversationId, prompt) {
    const ws = await workspaceApi.createFromChat({ channelType, conversationId, prompt });
    set({ workspaces: [...get().workspaces, ws] });
    return ws;
  },

  async startGeneration(workspaceId, prompt, options) {
    get().stopGeneration();
    const controller = new AbortController();
    set({ generating: true, generationOutput: [], abortController: controller });

    try {
      const response = await workspaceApi.generateStream(workspaceId, prompt, options);
      if (!response.ok || !response.body) {
        throw new Error(`Generation failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (controller.signal.aborted) {
          reader.cancel();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            const chunk: GenerationChunk = {
              id: `chunk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              content: parsed.content ?? parsed.text ?? data,
              timestamp: Date.now(),
            };
            set({ generationOutput: [...get().generationOutput, chunk] });
          } catch {
            const chunk: GenerationChunk = {
              id: `chunk-${Date.now()}`,
              content: data,
              timestamp: Date.now(),
            };
            set({ generationOutput: [...get().generationOutput, chunk] });
          }
        }
      }
    } catch (e) {
      if (!controller.signal.aborted) {
        set({ error: (e as Error).message });
      }
    } finally {
      set({ generating: false, abortController: null });
    }
  },

  stopGeneration() {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
      set({ generating: false, abortController: null });
    }
  },

  async fetchAgents() {
    try {
      const { agents } = await workspaceApi.listAgents();
      set({ agents });
    } catch {
      // 静默失败
    }
  },

  async installSkill(workspaceId, skillId) {
    await workspaceApi.installSkill(workspaceId, skillId);
  },

  async deployApp(workspaceId, appId) {
    await workspaceApi.deployApp(workspaceId, appId);
  },

  reset() {
    get().stopGeneration();
    set({
      workspaces: [],
      currentWorkspaceId: null,
      conversations: [],
      apps: [],
      agents: [],
      loading: false,
      generating: false,
      generationOutput: [],
      error: null,
    });
  },
}));
