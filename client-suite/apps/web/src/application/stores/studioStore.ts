/**
 * studioStore — Agent Studio 状态管理
 *
 * 管理我的资产列表、筛选、选中态、Agent管理等状态。
 */
import { create } from 'zustand';
import type {
  AssetItem,
  AssetType,
} from '../../presentation/features/studio/AssetCard';
import { studioApi } from '../services/studioApi';

type FilterType = 'all' | AssetType;

export type ManagementTab = 'orchestration' | 'knowledge' | 'settings' | 'release' | 'analytics';

/** 创建流程标识 — 进入后全屏接管，隐藏 Studio 外壳 */
export type CreateFlowType =
  | 'Skill'
  | 'App'
  | 'mcp-openapi'
  | 'mcp-database'
  | 'mcp-gateway'
  | null;

interface StudioState {
  // 资产列表
  assets: AssetItem[];
  loading: boolean;
  error: string | null;

  // 筛选
  filterType: FilterType;
  searchKeyword: string;

  // 选中态
  selectedAssetId: string | null;

  // Agent 管理（侧栏路由）
  managingAgentId: string | null;
  managementTab: ManagementTab;

  // MCP 详情查看
  viewingMcpId: string | null;

  // 通用资产详情（Skill / App）
  viewingAssetId: string | null;

  // 创建流程（全屏接管）
  activeCreateFlow: CreateFlowType;

  // 兼容旧接口
  orchestrationAgentId: string | null;

  // Actions
  fetchAssets(): Promise<void>;
  setFilterType(type: FilterType): void;
  setSearchKeyword(keyword: string): void;
  selectAsset(id: string | null): void;
  openAgentManagement(agentId: string, tab?: ManagementTab): void;
  setManagementTab(tab: ManagementTab): void;
  closeAgentManagement(): void;
  openMcpDetail(mcpId: string): void;
  closeMcpDetail(): void;
  openAssetDetail(assetId: string): void;
  closeAssetDetail(): void;
  enterCreateFlow(flow: CreateFlowType): void;
  exitCreateFlow(): void;
  /** @deprecated 使用 openAgentManagement(agentId, 'orchestration') */
  openOrchestration(agentId: string): void;
  /** @deprecated 使用 closeAgentManagement() */
  closeOrchestration(): void;
  installAsset(assetId: string, source: string): Promise<void>;
  uninstallAsset(assetId: string): Promise<void>;
  reset(): void;
}

export const useStudioStore = create<StudioState>((set, get) => ({
  assets: [],
  loading: false,
  error: null,
  filterType: 'all',
  searchKeyword: '',
  selectedAssetId: null,
  managingAgentId: null,
  managementTab: 'orchestration',
  viewingMcpId: null,
  viewingAssetId: null,
  activeCreateFlow: null,
  orchestrationAgentId: null,

  async fetchAssets() {
    set({ loading: true, error: null });
    try {
      const assets = await studioApi.listAssets();
      set({ assets, loading: false });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  setFilterType(type) {
    set({ filterType: type });
  },

  setSearchKeyword(keyword) {
    set({ searchKeyword: keyword });
  },

  selectAsset(id) {
    set({ selectedAssetId: id });
  },

  openAgentManagement(agentId, tab = 'orchestration') {
    set({ managingAgentId: agentId, managementTab: tab, orchestrationAgentId: agentId });
  },

  setManagementTab(tab) {
    set({ managementTab: tab });
  },

  closeAgentManagement() {
    set({ managingAgentId: null, managementTab: 'orchestration', orchestrationAgentId: null });
  },

  openMcpDetail(mcpId) {
    set({ viewingMcpId: mcpId });
  },

  closeMcpDetail() {
    set({ viewingMcpId: null });
  },

  openAssetDetail(assetId) {
    set({ viewingAssetId: assetId });
  },

  closeAssetDetail() {
    set({ viewingAssetId: null });
  },

  enterCreateFlow(flow) {
    set({ activeCreateFlow: flow });
  },

  exitCreateFlow() {
    set({ activeCreateFlow: null });
  },

  openOrchestration(agentId) {
    get().openAgentManagement(agentId, 'orchestration');
  },

  closeOrchestration() {
    get().closeAgentManagement();
  },

  async installAsset(assetId, source) {
    await studioApi.installAsset(assetId, source);
    await get().fetchAssets();
  },

  async uninstallAsset(assetId) {
    await studioApi.uninstallAsset(assetId);
    set((s) => ({ assets: s.assets.filter((a) => a.id !== assetId) }));
  },

  reset() {
    set({
      assets: [],
      loading: false,
      error: null,
      filterType: 'all',
      searchKeyword: '',
      selectedAssetId: null,
      managingAgentId: null,
      managementTab: 'orchestration',
      viewingMcpId: null,
      viewingAssetId: null,
      activeCreateFlow: null,
      orchestrationAgentId: null,
    });
  },
}));

// Derived selectors
export function useFilteredAssets() {
  const assets = useStudioStore((s) => s.assets);
  const filterType = useStudioStore((s) => s.filterType);
  const searchKeyword = useStudioStore((s) => s.searchKeyword);

  return assets.filter((a) => {
    if (filterType !== 'all' && a.type !== filterType) return false;
    if (searchKeyword && !a.name.toLowerCase().includes(searchKeyword.toLowerCase())) return false;
    return true;
  });
}

export function useManagingAgent() {
  const agentId = useStudioStore((s) => s.managingAgentId);
  const assets = useStudioStore((s) => s.assets);
  if (!agentId) return null;
  return (
    assets.find((a) => a.id === agentId) ?? {
      id: agentId,
      name: 'Agent',
      type: 'Agent' as const,
      origin: 'created' as const,
      status: 'draft' as const,
    }
  );
}
