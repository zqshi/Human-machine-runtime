/**
 * StudioPage — Agent Studio 主页面（暗色主题）
 *
 * 两 Tab 结构：我的资产 / 创建
 * 全屏接管优先级: Agent 管理 > MCP 详情 > Skill/App 详情 > 创建流程 > 默认 Tabs
 */
import { useState } from 'react';
import { useStudioStore } from '../../../application/stores/studioStore';
import { MyAssetsTab } from './MyAssetsTab';
import { CreateTab } from './create/CreateTab';
import { AgentManagementPage } from './management/AgentManagementPage';
import { McpDetailPage } from './management/McpDetailPage';
import { AssetDetailPage } from './management/AssetDetailPage';
import { SkillCreateFlow } from './create/SkillCreateFlow';
import { AppCreateFlow } from './create/AppCreateFlow';
import { McpOpenApiFlow } from './create/McpOpenApiFlow';
import { McpDatabaseFlow } from './create/McpDatabaseFlow';
import { McpGatewayFlow } from './create/McpGatewayFlow';

type StudioTab = 'assets' | 'create';

const TABS: { key: StudioTab; label: string; icon: string }[] = [
  { key: 'assets', label: '我的资产', icon: '📦' },
  { key: 'create', label: '创建', icon: '＋' },
];

export function StudioPage() {
  const [activeTab, setActiveTab] = useState<StudioTab>('assets');
  const managingAgentId = useStudioStore((s) => s.managingAgentId);
  const viewingMcpId = useStudioStore((s) => s.viewingMcpId);
  const viewingAssetId = useStudioStore((s) => s.viewingAssetId);
  const activeCreateFlow = useStudioStore((s) => s.activeCreateFlow);
  const exitCreateFlow = useStudioStore((s) => s.exitCreateFlow);
  const closeMcpDetail = useStudioStore((s) => s.closeMcpDetail);
  const closeAssetDetail = useStudioStore((s) => s.closeAssetDetail);

  // Agent 管理模式 — 全屏接管
  if (managingAgentId) {
    return <AgentManagementPage />;
  }

  // MCP 详情 — 全屏接管
  if (viewingMcpId) {
    return <McpDetailPage onBack={closeMcpDetail} />;
  }

  // Skill/App 详情 — 全屏接管
  if (viewingAssetId) {
    return <AssetDetailPage assetId={viewingAssetId} onBack={closeAssetDetail} />;
  }

  // 创建流程 — 全屏接管
  if (activeCreateFlow === 'Skill') return <SkillCreateFlow onBack={exitCreateFlow} />;
  if (activeCreateFlow === 'App') return <AppCreateFlow onBack={exitCreateFlow} />;
  if (activeCreateFlow === 'mcp-openapi') return <McpOpenApiFlow onBack={exitCreateFlow} />;
  if (activeCreateFlow === 'mcp-database') return <McpDatabaseFlow onBack={exitCreateFlow} />;
  if (activeCreateFlow === 'mcp-gateway') return <McpGatewayFlow onBack={exitCreateFlow} />;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header + Tabs */}
      <header className="shrink-0 px-6 pt-5 pb-0">
        <h1 className="text-lg font-bold text-slate-100 mb-4">Agent Studio</h1>
        <div className="flex items-center gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
              }`}
            >
              <span className="mr-1.5">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'assets' && <MyAssetsTab />}
        {activeTab === 'create' && <CreateTab />}
      </div>
    </div>
  );
}
