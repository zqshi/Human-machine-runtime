/**
 * MarketplacePanel — "共享" 入口面板
 *
 * 展示技能市场 + Agent 市场列表，嵌入 AttentionColumn A 栏 tab。
 */
import { useState, useEffect, useCallback } from 'react';
import { useMarketplaceStore } from '../../../application/stores/marketplaceStore';
import { Icon } from '../../components/ui/Icon';

type MarketplaceTab = 'skills' | 'agents';

function SkillCard({
  skill,
  onInstall,
}: {
  skill: {
    id: string;
    name: string;
    description?: string;
    author?: string;
    downloads?: number;
    rating?: number;
    category?: string;
  };
  onInstall: () => void;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5 hover:bg-white/[0.04] transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <Icon name="bolt" size={14} className="text-amber-400/70" />
        <span className="text-xs font-medium text-slate-200 truncate flex-1">{skill.name}</span>
        {skill.category && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400">
            {skill.category}
          </span>
        )}
      </div>
      {skill.description && (
        <p className="text-[11px] text-slate-400 line-clamp-2 pl-5 mb-1.5">{skill.description}</p>
      )}
      <div className="flex items-center justify-between pl-5">
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          {skill.author && <span>{skill.author}</span>}
          {skill.downloads != null && (
            <span className="flex items-center gap-0.5">
              <Icon name="download" size={10} />
              {skill.downloads}
            </span>
          )}
          {skill.rating != null && (
            <span className="flex items-center gap-0.5">
              <Icon name="star" size={10} className="text-amber-400" />
              {skill.rating.toFixed(1)}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onInstall}
          className="h-5 px-2 rounded text-[10px] text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
        >
          安装
        </button>
      </div>
    </div>
  );
}

function AgentCard({
  agent,
}: {
  agent: {
    id: string;
    name: string;
    description?: string;
    author?: string;
    capabilities?: string[];
  };
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5 hover:bg-white/[0.04] transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <Icon name="smart_toy" size={14} className="text-purple-400/70" />
        <span className="text-xs font-medium text-slate-200 truncate flex-1">{agent.name}</span>
      </div>
      {agent.description && (
        <p className="text-[11px] text-slate-400 line-clamp-2 pl-5">{agent.description}</p>
      )}
      {agent.capabilities && agent.capabilities.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5 pl-5">
          {agent.capabilities.slice(0, 3).map((cap) => (
            <span
              key={cap}
              className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300"
            >
              {cap}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function MarketplacePanel() {
  const skills = useMarketplaceStore((s) => s.skills);
  const agents = useMarketplaceStore((s) => s.agents);
  const loading = useMarketplaceStore((s) => s.loading);
  const error = useMarketplaceStore((s) => s.error);
  const fetchSkills = useMarketplaceStore((s) => s.fetchSkills);
  const fetchAgents = useMarketplaceStore((s) => s.fetchAgents);
  const installSkill = useMarketplaceStore((s) => s.installSkill);

  const [tab, setTab] = useState<MarketplaceTab>('skills');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchSkills();
    fetchAgents();
  }, [fetchSkills, fetchAgents]);

  const handleSearch = useCallback(() => {
    if (tab === 'skills') {
      fetchSkills({ keyword: search || undefined, page: 1 });
    } else {
      fetchAgents({ keyword: search || undefined, page: 1 });
    }
  }, [tab, search, fetchSkills, fetchAgents]);

  const handleInstall = useCallback(
    async (skillId: string) => {
      try {
        await installSkill(skillId);
      } catch {
        // 安装失败静默处理
      }
    },
    [installSkill]
  );

  return (
    <div className="flex-1 overflow-y-auto dcf-scrollbar">
      {/* Sub-tabs */}
      <div className="flex items-center gap-0 px-2 pt-2 pb-1">
        <button
          type="button"
          onClick={() => setTab('skills')}
          className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
            tab === 'skills' ? 'bg-primary/20 text-primary' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          技能
        </button>
        <button
          type="button"
          onClick={() => setTab('agents')}
          className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
            tab === 'agents' ? 'bg-primary/20 text-primary' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Agent
        </button>
      </div>

      {/* Search */}
      <div className="px-2 pb-2">
        <div className="flex gap-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={tab === 'skills' ? '搜索技能…' : '搜索 Agent…'}
            className="flex-1 h-7 px-2 rounded border border-white/10 bg-white/[0.04] text-[11px] text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-primary/40"
          />
          <button
            type="button"
            onClick={handleSearch}
            className="w-7 h-7 rounded bg-white/[0.06] flex items-center justify-center text-slate-400 hover:text-primary transition-colors"
          >
            <Icon name="search" size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading && (skills.length === 0 || agents.length === 0) ? (
        <div className="flex flex-col items-center py-8 text-slate-500">
          <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-2" />
          <p className="text-[11px]">加载中…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center py-8 text-slate-500 px-4">
          <p className="text-[11px] text-center">{error}</p>
        </div>
      ) : (
        <div className="px-2 pb-2 space-y-1.5">
          {tab === 'skills' ? (
            skills.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-slate-500">
                <Icon name="inventory_2" size={28} className="text-slate-600 mb-2" />
                <p className="text-[11px]">暂无可用技能</p>
              </div>
            ) : (
              skills.map((s) => (
                <SkillCard key={s.id} skill={s} onInstall={() => handleInstall(s.id)} />
              ))
            )
          ) : agents.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-slate-500">
              <Icon name="smart_toy" size={28} className="text-slate-600 mb-2" />
              <p className="text-[11px]">暂无可用 Agent</p>
            </div>
          ) : (
            agents.map((a) => <AgentCard key={a.id} agent={a} />)
          )}
        </div>
      )}
    </div>
  );
}
