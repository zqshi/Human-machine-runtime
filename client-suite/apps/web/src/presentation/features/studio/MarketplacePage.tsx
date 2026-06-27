/**
 * MarketplacePage — 共享中心独立页面（暗色主题）
 *
 * 独立 Dock 入口，合并展示 ClawHub 公共市场 + 本租户内部共享资产。
 * 支持按类别筛选、搜索、安装。
 * 点击卡片进入独立详情页（本地路由，不离开共享中心）。
 */
import { useState, useEffect, useCallback } from 'react';
import { useMarketplaceStore } from '../../../application/stores/marketplaceStore';
import { useStudioStore } from '../../../application/stores/studioStore';
import { useToastStore } from '../../../application/stores/toastStore';
import { useUIStore } from '../../../application/stores/uiStore';
import {
  appCatalogApi,
  type AppCatalogItem,
  marketplaceApi,
  upstreamMarketplaceApi,
} from '../../../application/services/adminApi';
import { sharedAgentChatService } from '../../../application/services/sharedAgentChatService';
import { SkillDetailView } from './marketplace/SkillDetailView';
import { McpDetailView } from './marketplace/McpDetailView';
import { AgentDetailView } from './marketplace/AgentDetailView';
import { Icon } from '../../components/ui/Icon';

type MarketTab = 'skills' | 'mcp' | 'agents' | 'apps';
const MARKET_TABS: { key: MarketTab; label: string; icon: string }[] = [
  { key: 'skills', label: 'Skill', icon: 'bolt' },
  { key: 'mcp', label: 'MCP', icon: 'build' },
  { key: 'agents', label: 'Agent', icon: 'smart_toy' },
  { key: 'apps', label: 'App', icon: 'grid_view' },
];

/** MCP 列表项(真实 listMcpTools 返回的工具映射;mode/icon/color/toolCount/installs 无真实值时默认) */
interface McpListItem {
  id: string;
  name: string;
  description: string;
  mode: string;
  icon: string;
  color: string;
  toolCount: number;
  installs: number;
}

export function MarketplacePage() {
  const [activeTab, setActiveTab] = useState<MarketTab>('skills');
  const [search, setSearch] = useState('');
  const [detailView, setDetailView] = useState<{ type: MarketTab; id: string } | null>(null);
  const skills = useMarketplaceStore((s) => s.skills);
  const agents = useMarketplaceStore((s) => s.agents);
  const loading = useMarketplaceStore((s) => s.loading);
  const fetchSkills = useMarketplaceStore((s) => s.fetchSkills);
  const fetchAgents = useMarketplaceStore((s) => s.fetchAgents);
  const installSkill = useMarketplaceStore((s) => s.installSkill);
  const fetchAssets = useStudioStore((s) => s.fetchAssets);

  // App catalog
  const [apps, setApps] = useState<AppCatalogItem[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);

  // MCP 工具列表(去 mock:真实 listMcpTools,失败 toast+空)
  const [mcpTools, setMcpTools] = useState<McpListItem[]>([]);

  useEffect(() => {
    fetchSkills();
    fetchAgents();
  }, [fetchSkills, fetchAgents]);

  const fetchApps = useCallback(() => {
    setAppsLoading(true);
    appCatalogApi
      .list()
      .then((res) => setApps(Object.values(res.grouped).flat()))
      .catch(() => {})
      .finally(() => setAppsLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === 'apps' && apps.length === 0) fetchApps();
  }, [activeTab, apps.length, fetchApps]);

  const fetchMcpTools = useCallback(() => {
    upstreamMarketplaceApi
      .listMcpTools()
      .then((res) => {
        const tools = (res.tools ?? []).map(
          (t: Record<string, unknown>, i: number): McpListItem => ({
            id: String(t.id ?? t.name ?? `mcp-${i}`),
            name: String(t.name ?? t.id ?? 'MCP 工具'),
            description: String(t.description ?? ''),
            mode: String(t.mode ?? t.type ?? 'MCP'),
            icon: 'build',
            color: 'bg-primary/10',
            toolCount: Number(t.toolCount ?? t.tool_count ?? 0),
            installs: Number(t.installs ?? 0),
          })
        );
        setMcpTools(tools);
      })
      .catch(() => {
        useToastStore.getState().addToast('MCP 服务不可用,请检查后端', 'error');
        setMcpTools([]);
      });
  }, []);

  useEffect(() => {
    if (activeTab === 'mcp' && mcpTools.length === 0) fetchMcpTools();
  }, [activeTab, mcpTools.length, fetchMcpTools]);

  const handleSearch = (keyword: string) => {
    setSearch(keyword);
    if (activeTab === 'skills') fetchSkills({ keyword });
    if (activeTab === 'agents') fetchAgents({ keyword });
  };

  const handleInstall = async (id: string, name: string) => {
    try {
      await installSkill(id);
      useToastStore.getState().addToast(`已安装 ${name}`, 'success');
      fetchAssets();
    } catch {
      useToastStore.getState().addToast('安装失败', 'error');
    }
  };

  const filteredApps = apps.filter(
    (a) => !search || a.name.toLowerCase().includes(search.toLowerCase())
  );

  // ── 详情页路由 ──
  if (detailView) {
    const handleBack = () => setDetailView(null);

    if (detailView.type === 'skills') {
      const skill = skills.find((s) => s.id === detailView.id);
      if (skill) {
        return (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <header className="h-[48px] flex items-center justify-between px-6 border-b border-white/[0.08] bg-white/[0.02] shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBack}
                  className="text-[11px] text-slate-400 hover:text-primary flex items-center gap-1"
                >
                  <Icon name="arrow_back" size={13} /> 返回
                </button>
                <Icon name="bolt" size={16} className="text-amber-400" />
                <h2 className="text-[14px] font-semibold text-slate-100">{skill.name}</h2>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400">
                  Skill
                </span>
              </div>
              <button
                onClick={() => handleInstall(skill.id, skill.name)}
                className="h-7 px-4 rounded-lg text-[11px] font-medium bg-primary text-white hover:opacity-90"
              >
                安装
              </button>
            </header>
            <SkillDetailView skill={skill} />
          </div>
        );
      }
    }

    if (detailView.type === 'mcp') {
      const mcp = mcpTools.find((m) => m.id === detailView.id);
      if (mcp) {
        return (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <header className="h-[48px] flex items-center justify-between px-6 border-b border-white/[0.08] bg-white/[0.02] shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBack}
                  className="text-[11px] text-slate-400 hover:text-primary flex items-center gap-1"
                >
                  <Icon name="arrow_back" size={13} /> 返回
                </button>
                <Icon name="build" size={16} className="text-slate-300" />
                <h2 className="text-[14px] font-semibold text-slate-100">{mcp.name}</h2>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400">
                  MCP · {mcp.mode}
                </span>
              </div>
              <button
                onClick={() => useToastStore.getState().addToast(`已安装 ${mcp.name}`, 'success')}
                className="h-7 px-4 rounded-lg text-[11px] font-medium bg-primary text-white hover:opacity-90"
              >
                安装
              </button>
            </header>
            <McpDetailView mcp={mcp} />
          </div>
        );
      }
    }

    if (detailView.type === 'agents') {
      const agent = agents.find((a) => a.id === detailView.id);
      if (agent) {
        return (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <header className="h-[48px] flex items-center justify-between px-6 border-b border-white/[0.08] bg-white/[0.02] shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleBack}
                  className="text-[11px] text-slate-400 hover:text-primary flex items-center gap-1"
                >
                  <Icon name="arrow_back" size={13} /> 返回
                </button>
                <Icon
                  name={((agent as Record<string, unknown>).icon as string) || 'smart_toy'}
                  size={16}
                  className="text-purple-400"
                />
                <h2 className="text-[14px] font-semibold text-slate-100">{agent.name}</h2>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400">
                  Agent
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    try {
                      const res = await marketplaceApi.installAgent(agent.id);
                      if (!res.success || !res.data) {
                        useToastStore.getState().addToast('安装失败，请重试', 'error');
                        return;
                      }
                      sharedAgentChatService.openInstalledInstance(
                        res.data.instanceId,
                        res.data.name
                      );
                      useUIStore.getState().setDock('messages');
                      useToastStore
                        .getState()
                        .addToast(`已安装「${res.data.name}」并打开对话`, 'success');
                    } catch {
                      useToastStore.getState().addToast('安装失败，请重试', 'error');
                    }
                  }}
                  className="h-7 px-3 rounded-lg text-[11px] font-medium bg-primary text-white hover:opacity-90"
                >
                  对话
                </button>
              </div>
            </header>
            <AgentDetailView agent={agent} />
          </div>
        );
      }
    }

    // fallback: 回到列表
    setDetailView(null);
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="shrink-0 px-6 pt-5 pb-0">
        <h1 className="text-lg font-bold text-slate-100 mb-4">共享中心</h1>
        {/* Tabs + Search */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1">
            {MARKET_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${
                  activeTab === tab.key
                    ? 'bg-primary text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
                }`}
              >
                <Icon name={tab.icon} size={12} />
                {tab.label}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="h-8 w-56 px-3 border border-white/[0.1] rounded-lg text-xs outline-none bg-white/[0.04] text-slate-200 placeholder:text-slate-500 focus:border-primary/50 transition-colors"
            placeholder="🔍 搜索共享资源"
          />
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 hmr-scrollbar">
        {(loading || (activeTab === 'apps' && appsLoading)) && (
          <div className="flex items-center justify-center py-12 text-sm text-slate-500">
            加载中...
          </div>
        )}

        {/* Skills */}
        {!loading && activeTab === 'skills' && (
          <div className="grid grid-cols-1 gap-2">
            {skills.length === 0 && (
              <div className="text-center py-12 text-sm text-slate-500">暂无可用技能</div>
            )}
            {skills.map((skill) => (
              <div
                key={skill.id}
                onClick={() => setDetailView({ type: 'skills', id: skill.id })}
                className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.15] transition-all cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Icon name="bolt" size={18} className="text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-slate-100 truncate">
                      {skill.name}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-white/[0.06] text-slate-400">
                      {(skill as Record<string, unknown>).source === 'tenant'
                        ? '🏢 组织'
                        : '🌍 ClawHub'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">
                    {skill.description || '—'} {skill.author && `· ${skill.author}`}
                  </p>
                </div>
                <div
                  className="flex items-center gap-2 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  {skill.downloads != null && (
                    <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                      <Icon name="download" size={10} /> {skill.downloads}
                    </span>
                  )}
                  <button
                    onClick={() => handleInstall(skill.id, skill.name)}
                    className="h-7 px-3 rounded-lg text-[11px] font-medium bg-primary text-white hover:opacity-90 transition-opacity"
                  >
                    安装
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Agents */}
        {!loading && activeTab === 'agents' && (
          <div className="grid grid-cols-1 gap-2">
            {agents.length === 0 && (
              <div className="text-center py-12 text-sm text-slate-500">暂无可用 Agent</div>
            )}
            {agents.map((agent) => (
              <div
                key={agent.id}
                onClick={() => setDetailView({ type: 'agents', id: agent.id })}
                className="flex items-center gap-3 p-4 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.15] transition-all cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-primary/20 flex items-center justify-center shrink-0">
                  <Icon
                    name={((agent as Record<string, unknown>).icon as string) || 'smart_toy'}
                    size={20}
                    className="text-slate-200"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-medium text-slate-100 truncate block">
                    {agent.name}
                  </span>
                  <p className="text-[11px] text-slate-500 truncate">{agent.description || '—'}</p>
                </div>
                <div
                  className="flex items-center gap-2 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={async () => {
                      try {
                        const res = await marketplaceApi.installAgent(agent.id);
                        if (!res.success || !res.data) {
                          useToastStore.getState().addToast('安装失败，请重试', 'error');
                          return;
                        }
                        sharedAgentChatService.openInstalledInstance(
                          res.data.instanceId,
                          res.data.name
                        );
                        useUIStore.getState().setDock('messages');
                        useToastStore
                          .getState()
                          .addToast(`已安装「${res.data.name}」并打开对话`, 'success');
                      } catch {
                        useToastStore.getState().addToast('安装失败，请重试', 'error');
                      }
                    }}
                    className="h-7 px-3 rounded-lg text-[11px] font-medium bg-primary text-white hover:opacity-90 transition-opacity"
                  >
                    对话
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MCP */}
        {!loading && activeTab === 'mcp' && (
          <div className="grid grid-cols-1 gap-2">
            {mcpTools
              .filter(
                (m) =>
                  !search ||
                  m.name.toLowerCase().includes(search.toLowerCase()) ||
                  m.description.includes(search)
              )
              .map((mcp) => (
                <div
                  key={mcp.id}
                  onClick={() => setDetailView({ type: 'mcp', id: mcp.id })}
                  className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.15] transition-all cursor-pointer"
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${mcp.color}`}
                  >
                    <Icon name={mcp.icon} size={18} className="text-slate-200" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-slate-100 truncate">
                        {mcp.name}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-white/[0.06] text-slate-400">
                        {mcp.mode}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">
                      {mcp.description} · {mcp.toolCount} 工具
                    </p>
                  </div>
                  <div
                    className="flex items-center gap-2 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                      <Icon name="download" size={10} /> {mcp.installs}
                    </span>
                    <button
                      onClick={() =>
                        useToastStore.getState().addToast(`已安装 ${mcp.name}`, 'success')
                      }
                      className="h-7 px-3 rounded-lg text-[11px] font-medium bg-primary text-white hover:opacity-90 transition-opacity"
                    >
                      安装
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Apps */}
        {!appsLoading && activeTab === 'apps' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredApps.length === 0 && (
              <div className="col-span-full text-center py-12 text-sm text-slate-500">
                暂无可用应用
              </div>
            )}
            {filteredApps.map((app) => (
              <div
                key={app.id}
                className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.15] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
                    <Icon name="grid_view" size={16} className="text-sky-400" />
                  </div>
                  <span className="text-[13px] font-medium text-slate-100 truncate">
                    {app.name}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-2">{app.description || '—'}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
