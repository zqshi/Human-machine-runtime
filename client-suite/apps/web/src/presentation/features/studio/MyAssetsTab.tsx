/**
 * MyAssetsTab — 我的资产列表（暗色主题）
 *
 * 展示用户拥有的全部 AI 资产，支持按类型筛选，区分来源。
 */
import { useEffect, useMemo } from 'react';
import { useStudioStore, useFilteredAssets } from '../../../application/stores/studioStore';
import { AssetCard, type AssetItem, type AssetType } from './AssetCard';
import { useToastStore } from '../../../application/stores/toastStore';
import { Icon } from '../../components/ui/Icon';

type FilterTab = 'all' | AssetType;
const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'Agent', label: 'Agent' },
  { key: 'Skill', label: 'Skill' },
  { key: 'MCP', label: 'MCP' },
  { key: 'App', label: 'App' },
];

export function MyAssetsTab() {
  const fetchAssets = useStudioStore((s) => s.fetchAssets);
  const loading = useStudioStore((s) => s.loading);
  const filterType = useStudioStore((s) => s.filterType);
  const setFilterType = useStudioStore((s) => s.setFilterType);
  const searchKeyword = useStudioStore((s) => s.searchKeyword);
  const setSearchKeyword = useStudioStore((s) => s.setSearchKeyword);
  const openAgentManagement = useStudioStore((s) => s.openAgentManagement);
  const openMcpDetail = useStudioStore((s) => s.openMcpDetail);
  const openAssetDetail = useStudioStore((s) => s.openAssetDetail);
  const uninstallAsset = useStudioStore((s) => s.uninstallAsset);

  const filteredAssets = useFilteredAssets();

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  /** 点击卡片 — 根据类型路由到不同详情页 */
  const handleClick = (asset: AssetItem) => {
    switch (asset.type) {
      case 'Agent':
        openAgentManagement(asset.id);
        break;
      case 'MCP':
        openMcpDetail(asset.id);
        break;
      case 'Skill':
      case 'App':
        openAssetDetail(asset.id);
        break;
    }
  };

  const handleConfigure = (asset: AssetItem) => {
    if (asset.type === 'Agent') {
      openAgentManagement(asset.id);
    } else if (asset.type === 'MCP') {
      openMcpDetail(asset.id);
    } else {
      openAssetDetail(asset.id);
    }
  };

  const handleUse = (asset: AssetItem) => {
    useToastStore.getState().addToast(`启动 ${asset.name}...`, 'info');
  };

  const handleUninstall = async (asset: AssetItem) => {
    try {
      await uninstallAsset(asset.id);
      useToastStore.getState().addToast(`已卸载 ${asset.name}`, 'success');
    } catch {
      useToastStore.getState().addToast('卸载失败', 'error');
    }
  };

  const assets = useStudioStore((s) => s.assets);
  const stats = useMemo(
    () => ({
      total: assets.length,
      created: assets.filter((a) => a.origin === 'created').length,
      installed: assets.filter((a) => a.origin === 'installed').length,
      shared: assets.filter((a) => a.origin === 'shared').length,
    }),
    [assets]
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-6">
      {/* Stats */}
      <div className="flex gap-3 mb-4">
        {[
          { label: '总资产', value: stats.total, color: 'text-slate-100' },
          { label: '自建', value: stats.created, color: 'text-sky-400' },
          { label: '已安装', value: stats.installed, color: 'text-emerald-400' },
          { label: '组织共享', value: stats.shared, color: 'text-slate-400' },
        ].map((s) => (
          <div
            key={s.label}
            className="flex-1 px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03]"
          >
            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter + Search */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterType(tab.key)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${
                filterType === tab.key
                  ? 'bg-primary text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          className="h-8 w-48 px-3 border border-white/[0.1] rounded-lg text-xs outline-none bg-white/[0.04] text-slate-200 placeholder:text-slate-500 focus:border-primary/50 transition-colors"
          placeholder="🔍 搜索资产"
        />
      </div>

      {/* Asset List */}
      <div className="flex-1 overflow-y-auto space-y-2 hmr-scrollbar">
        {loading && (
          <div className="flex items-center justify-center py-12 text-slate-500 text-sm">
            加载中...
          </div>
        )}
        {!loading && filteredAssets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Icon name="inbox" size={32} className="mb-2 opacity-30" />
            <span className="text-sm">暂无资产</span>
            <span className="text-[11px] mt-1">去「共享中心」安装或「创建」新资产</span>
          </div>
        )}
        {filteredAssets.map((asset) => (
          <AssetCard
            key={asset.id}
            asset={asset}
            onClick={handleClick}
            onConfigure={asset.origin === 'created' ? handleConfigure : undefined}
            onUse={handleUse}
            onUninstall={asset.origin === 'installed' ? handleUninstall : undefined}
          />
        ))}
      </div>
    </div>
  );
}
