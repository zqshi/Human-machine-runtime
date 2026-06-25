/**
 * marketplaceStore — "共享" 功能状态管理
 *
 * 管理技能市场浏览、安装、发布审批流程。
 * 数据源：marketplaceApiClient
 */

import { create } from 'zustand';
import type {
  MarketplaceSkillDTO,
  MarketplaceAgentDTO,
  PublishApprovalDTO,
} from '../../infrastructure/api/marketplaceApiClient';
import { marketplaceApi } from '../../infrastructure/api/marketplaceApiClient';
import { useToastStore } from './toastStore';

interface MarketplaceState {
  skills: MarketplaceSkillDTO[];
  agents: MarketplaceAgentDTO[];
  approvals: PublishApprovalDTO[];
  selectedSkill: MarketplaceSkillDTO | null;
  selectedAgent: MarketplaceAgentDTO | null;
  loading: boolean;
  error: string | null;
  searchKeyword: string;
  page: number;
  hasMore: boolean;

  fetchSkills(params?: { keyword?: string; page?: number }): Promise<void>;
  fetchAgents(params?: { keyword?: string; page?: number }): Promise<void>;
  selectSkill(id: string): Promise<void>;
  selectAgent(id: string): Promise<void>;
  installSkill(skillId: string, version?: string): Promise<void>;
  requestPublish(skillSlug: string, version?: string, changelog?: string): Promise<void>;
  fetchApprovals(): Promise<void>;
  approve(id: string): Promise<void>;
  reject(id: string, reason?: string): Promise<void>;
  setSearchKeyword(keyword: string): void;
  reset(): void;
}

export const useMarketplaceStore = create<MarketplaceState>((set, get) => ({
  skills: [],
  agents: [],
  approvals: [],
  selectedSkill: null,
  selectedAgent: null,
  loading: false,
  error: null,
  searchKeyword: '',
  page: 1,
  hasMore: true,

  async fetchSkills(params) {
    set({ loading: true, error: null });
    try {
      const keyword = params?.keyword ?? get().searchKeyword;
      const page = params?.page ?? 1;
      const res = await marketplaceApi.listSkills({
        keyword: keyword || undefined,
        page,
        pageSize: 20,
      });
      const data = res.data as
        | { items?: MarketplaceSkillDTO[]; total?: number }
        | MarketplaceSkillDTO[];
      const items = Array.isArray(data) ? data : (data.items ?? []);
      if (page === 1) {
        set({ skills: items, page, loading: false });
      } else {
        set({ skills: [...get().skills, ...items], page, loading: false });
      }
      const total = Array.isArray(data) ? data.length : (data.total ?? 0);
      set({ hasMore: get().skills.length < total });
    } catch {
      useToastStore.getState().addToast('市场服务不可用,请检查后端', 'error');
      set({ skills: [], loading: false, error: 'marketplace unavailable' });
    }
  },

  async fetchAgents(params) {
    set({ loading: true, error: null });
    try {
      const keyword = params?.keyword ?? get().searchKeyword;
      const page = params?.page ?? 1;
      const res = await marketplaceApi.listAgents({
        keyword: keyword || undefined,
        page,
        pageSize: 20,
      });
      const data = res.data as
        | { items?: MarketplaceAgentDTO[]; total?: number }
        | MarketplaceAgentDTO[];
      const items = Array.isArray(data) ? data : (data.items ?? []);
      set({ agents: items, loading: false });
    } catch {
      useToastStore.getState().addToast('市场服务不可用,请检查后端', 'error');
      set({ agents: [], loading: false, error: 'marketplace unavailable' });
    }
  },

  async selectSkill(id) {
    set({ loading: true });
    try {
      const res = await marketplaceApi.getSkill(id);
      set({ selectedSkill: res.data, loading: false });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  async selectAgent(id) {
    set({ loading: true });
    try {
      const res = await marketplaceApi.getAgent(id);
      set({ selectedAgent: res.data, loading: false });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  async installSkill(skillId, version) {
    await marketplaceApi.installSkill(skillId, version);
  },

  async requestPublish(skillSlug, version, changelog) {
    await marketplaceApi.requestPublish({ skillSlug, version, changelog });
  },

  async fetchApprovals() {
    try {
      const res = await marketplaceApi.listApprovals();
      set({ approvals: res.data });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  async approve(id) {
    const res = await marketplaceApi.approve(id);
    set({
      approvals: get().approvals.map((a) => (a.id === id ? res.data : a)),
    });
  },

  async reject(id, reason) {
    const res = await marketplaceApi.reject(id, reason);
    set({
      approvals: get().approvals.map((a) => (a.id === id ? res.data : a)),
    });
  },

  setSearchKeyword(keyword: string) {
    set({ searchKeyword: keyword });
  },

  reset() {
    set({
      skills: [],
      agents: [],
      approvals: [],
      selectedSkill: null,
      selectedAgent: null,
      loading: false,
      error: null,
      searchKeyword: '',
      page: 1,
      hasMore: true,
    });
  },
}));
