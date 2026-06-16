/**
 * orchestrationStore — Agent 编排配置状态管理
 *
 * 管理当前编排的 Agent 的 prompt/model/tools/skills/knowledge 等配置。
 */
import { create } from 'zustand';
import { studioApi } from '../services/studioApi';

export interface McpRef {
  id: string;
  name: string;
  description?: string;
  toolCount: number;
}

export interface SkillRef {
  id: string;
  name: string;
  description: string;
  icon?: string;
}

interface OrchestrationState {
  agentId: string | null;
  loading: boolean;

  // Config fields
  systemPrompt: string;
  modelId: string;
  openingMessage: string;
  presetQuestions: string[];
  shortcuts: string[];
  humanize: boolean;
  webSearch: boolean;
  mcpRefs: McpRef[];
  skillRefs: SkillRef[];
  knowledgeBaseIds: string[];
  publishedVersion: string | null;
  dirty: boolean;

  // Actions
  loadConfig(agentId: string): Promise<void>;
  updateField<K extends keyof OrchestrationState>(key: K, value: OrchestrationState[K]): void;
  addMcpRef(mcp: McpRef): void;
  removeMcpRef(id: string): void;
  addSkillRef(skill: SkillRef): void;
  removeSkillRef(id: string): void;
  addPresetQuestion(q: string): void;
  removePresetQuestion(idx: number): void;
  addShortcut(s: string): void;
  removeShortcut(idx: number): void;
  saveDraft(): Promise<void>;
  publish(version: string): Promise<void>;
  reset(): void;
}

export const useOrchestrationStore = create<OrchestrationState>((set, get) => ({
  agentId: null,
  loading: false,
  systemPrompt: '',
  modelId: 'claude-sonnet-4',
  openingMessage: '',
  presetQuestions: [],
  shortcuts: [],
  humanize: false,
  webSearch: false,
  mcpRefs: [],
  skillRefs: [],
  knowledgeBaseIds: [],
  publishedVersion: null,
  dirty: false,

  async loadConfig(agentId) {
    set({ loading: true, agentId });
    try {
      const config = await studioApi.getAgentConfig(agentId);
      set({
        systemPrompt: config.systemPrompt,
        modelId: config.modelId,
        openingMessage: config.openingMessage,
        presetQuestions: config.presetQuestions,
        shortcuts: config.shortcuts,
        humanize: config.humanize,
        webSearch: config.webSearch,
        mcpRefs: config.mcpRefs,
        skillRefs: config.skillRefs,
        knowledgeBaseIds: config.knowledgeBaseIds,
        publishedVersion: config.publishedVersion,
        loading: false,
        dirty: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  updateField(key, value) {
    set({ [key]: value, dirty: true } as Partial<OrchestrationState>);
  },

  addMcpRef(mcp) {
    const { mcpRefs } = get();
    if (mcpRefs.find((m) => m.id === mcp.id)) return;
    set({ mcpRefs: [...mcpRefs, mcp], dirty: true });
  },

  removeMcpRef(id) {
    set((s) => ({ mcpRefs: s.mcpRefs.filter((m) => m.id !== id), dirty: true }));
  },

  addSkillRef(skill) {
    const { skillRefs } = get();
    if (skillRefs.find((s) => s.id === skill.id)) return;
    set({ skillRefs: [...skillRefs, skill], dirty: true });
  },

  removeSkillRef(id) {
    set((s) => ({ skillRefs: s.skillRefs.filter((s2) => s2.id !== id), dirty: true }));
  },

  addPresetQuestion(q) {
    set((s) => ({ presetQuestions: [...s.presetQuestions, q], dirty: true }));
  },

  removePresetQuestion(idx) {
    set((s) => ({ presetQuestions: s.presetQuestions.filter((_, i) => i !== idx), dirty: true }));
  },

  addShortcut(s) {
    set((st) => ({ shortcuts: [...st.shortcuts, s], dirty: true }));
  },

  removeShortcut(idx) {
    set((s) => ({ shortcuts: s.shortcuts.filter((_, i) => i !== idx), dirty: true }));
  },

  async saveDraft() {
    const s = get();
    if (!s.agentId) return;
    await studioApi.saveAgentConfig(s.agentId, {
      systemPrompt: s.systemPrompt,
      modelId: s.modelId,
      openingMessage: s.openingMessage,
      presetQuestions: s.presetQuestions,
      shortcuts: s.shortcuts,
      humanize: s.humanize,
      webSearch: s.webSearch,
      mcpRefs: s.mcpRefs,
      skillRefs: s.skillRefs,
      knowledgeBaseIds: s.knowledgeBaseIds,
    });
    set({ dirty: false });
  },

  async publish(version) {
    const s = get();
    if (!s.agentId) return;
    await s.saveDraft();
    await studioApi.publishAgent(s.agentId, version);
    set({ publishedVersion: version, dirty: false });
  },

  reset() {
    set({
      agentId: null,
      loading: false,
      systemPrompt: '',
      modelId: 'claude-sonnet-4',
      openingMessage: '',
      presetQuestions: [],
      shortcuts: [],
      humanize: false,
      webSearch: false,
      mcpRefs: [],
      skillRefs: [],
      knowledgeBaseIds: [],
      publishedVersion: null,
      dirty: false,
    });
  },
}));
