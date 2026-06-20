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

/* ─── Mock 数据 — 后端不可用时填充演示 ─── */

const MOCK_SKILLS: MarketplaceSkillDTO[] = [
  {
    id: 'mk-sql',
    name: 'SQL 智能优化',
    description: '分析慢查询并输出索引优化建议',
    version: 'v2.1.0',
    author: '技术部',
    category: '数据',
    downloads: 1280,
    source: 'tenant',
  },
  {
    id: 'mk-summary',
    name: '文本智能摘要',
    description: '长文本自动提取核心信息并生成结构化摘要',
    version: 'v1.5.0',
    author: 'ClawHub',
    category: '文本处理',
    downloads: 3420,
    source: 'marketplace',
  },
  {
    id: 'mk-codereview',
    name: '代码审查助手',
    description: '多语言代码质量分析、安全漏洞检测',
    version: 'v3.0.1',
    author: 'ClawHub',
    category: '开发',
    downloads: 2150,
    source: 'marketplace',
  },
  {
    id: 'mk-translate',
    name: '多语言翻译',
    description: '支持 20+ 语言互译，自动术语管理',
    version: 'v2.0.0',
    author: '国际化团队',
    category: '翻译',
    downloads: 890,
    source: 'tenant',
  },
  {
    id: 'mk-report',
    name: '周报自动生成',
    description: '根据 Git 提交和任务卡片自动生成工作报告',
    version: 'v1.2.0',
    author: 'ClawHub',
    category: '效率',
    downloads: 4560,
    source: 'marketplace',
  },
  {
    id: 'mk-dataclean',
    name: '数据清洗流水线',
    description: '结构化数据去重、标准化、异常检测',
    version: 'v1.0.0',
    author: '数据团队',
    category: '数据',
    downloads: 560,
    source: 'tenant',
  },
  {
    id: 'mk-meeting',
    name: '会议纪要提取',
    description: '从录音/文字记录中提取行动项和决议',
    version: 'v1.3.0',
    author: 'ClawHub',
    category: '效率',
    downloads: 1890,
    source: 'marketplace',
  },
  {
    id: 'mk-competitor',
    name: '竞品分析',
    description: '自动搜集竞品信息并生成对比报告',
    version: 'v0.9.0',
    author: '产品部',
    category: '研究',
    downloads: 320,
    source: 'tenant',
  },
];

const MOCK_AGENTS: MarketplaceAgentDTO[] = [
  {
    id: 'mka-cs',
    name: '智能客服',
    description: '自动回复常见问题，支持意图识别和工单创建',
    version: 'v2.0.0',
    author: '客服部',
    capabilities: ['知识库问答', '工单路由', '情绪识别'],
    icon: 'headset_mic',
  },
  {
    id: 'mka-data',
    name: '数据分析师',
    description: '对话式数据探索，自动生成 SQL 和可视化图表',
    version: 'v1.5.0',
    author: 'ClawHub',
    capabilities: ['SQL 生成', '图表输出', '异常检测'],
    icon: 'insights',
  },
  {
    id: 'mka-hr',
    name: '招聘面试官',
    description: '根据岗位 JD 出题，评估候选人并打分',
    version: 'v1.1.0',
    author: 'HR 部门',
    capabilities: ['题目生成', '回答评估', '报告输出'],
    icon: 'person_search',
  },
  {
    id: 'mka-legal',
    name: '合规审查助手',
    description: '审查合同文档是否符合法规和公司政策',
    version: 'v1.0.0',
    author: '法务部',
    capabilities: ['条款审查', '风险提示', '修改建议'],
    icon: 'gavel',
  },
  {
    id: 'mka-pm',
    name: '项目管理助手',
    description: '跟踪任务进度、生成周报、识别风险',
    version: 'v1.2.0',
    author: 'ClawHub',
    capabilities: ['进度追踪', '风险预警', '报告生成'],
    icon: 'assignment',
  },
];

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
      // 后端不可用 → mock fallback
      const keyword = params?.keyword ?? get().searchKeyword;
      const filtered = keyword
        ? MOCK_SKILLS.filter(
            (s) => s.name.includes(keyword) || (s.description ?? '').includes(keyword)
          )
        : MOCK_SKILLS;
      set({ skills: filtered, loading: false, error: null });
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
      // 后端不可用 → mock fallback
      const keyword = params?.keyword ?? get().searchKeyword;
      const filtered = keyword
        ? MOCK_AGENTS.filter(
            (a) => a.name.includes(keyword) || (a.description ?? '').includes(keyword)
          )
        : MOCK_AGENTS;
      set({ agents: filtered, loading: false, error: null });
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
