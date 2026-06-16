/**
 * SkillsCenter — 技能中心
 * 从后端共享 Agent 数据加载，替代硬编码
 */
import { useState, useMemo, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { SearchInput } from '../../components/ui/SearchInput';
import { useToastStore } from '../../../application/stores/toastStore';
import { agentApi, clawHubApi } from '../../../application/services/apiGateway';
import type { SkillItem } from '../../../application/services/apiGateway';

interface Skill {
  id: string;
  name: string;
  icon: string;
  category: 'general' | 'domain';
  desc: string;
  roles: string[];
  usage: number;
  author: string;
}

/** Map backend SharedAgentDTO to Skill display model */
function toSkill(agent: Record<string, unknown>): Skill {
  const tags = Array.isArray(agent.tags) ? (agent.tags as string[]) : [];
  return {
    id: String(agent.id ?? ''),
    name: String(agent.name || agent.capabilitySignature || '未命名'),
    icon: tags.includes('dev')
      ? '💻'
      : tags.includes('finance')
        ? '📊'
        : tags.includes('hr')
          ? '👥'
          : '🔧',
    category: agent.ownerType === 'shared' ? 'general' : 'domain',
    desc: String(agent.description || agent.capabilitySignature || ''),
    roles: Array.isArray(agent.jobCodes) ? (agent.jobCodes as string[]) : tags.slice(0, 3),
    usage: Number(agent.usageCount) || 0,
    author: String(agent.source || 'runtime/openclaw'),
  };
}

/** Map upstream SkillItem (from clawHubApi) to Skill display model */
function upstreamSkillToSkill(item: SkillItem): Skill {
  return {
    id: `upstream-${item.id}`,
    name: item.name,
    icon:
      item.category === 'dev'
        ? '💻'
        : item.category === 'finance'
          ? '📊'
          : item.category === 'hr'
            ? '👥'
            : '🔧',
    category: 'general',
    desc: item.description ?? '',
    roles: item.category ? [item.category] : [],
    usage: 0,
    author: item.source ?? 'clawhub',
  };
}

/** Merge local and upstream skills, deduplicating by name */
function mergeSkills(local: Skill[], upstream: Skill[]): Skill[] {
  const localNames = new Set(local.map((s) => s.name.toLowerCase()));
  return [...local, ...upstream.filter((s) => !localNames.has(s.name.toLowerCase()))];
}

type TabKey = 'all' | 'general' | 'domain';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'general', label: '通用' },
  { key: 'domain', label: '领域' },
];

export function SkillsSidebar() {
  const [skills, setSkills] = useState<Skill[]>([]);

  useEffect(() => {
    const localP = agentApi
      .listShared()
      .then((res) => (res.rows || []).map(toSkill).slice(0, 8))
      .catch(() => [] as Skill[]);

    const upstreamP = clawHubApi
      .listSkills()
      .then((res) => (res.items || []).map(upstreamSkillToSkill))
      .catch((err) => {
        console.warn('[SkillsSidebar] clawHubApi.listSkills failed:', err);
        return [] as Skill[];
      });

    Promise.all([localP, upstreamP]).then(([local, upstream]) => {
      setSkills(mergeSkills(local, upstream).slice(0, 8));
    });
  }, []);

  return (
    <div className="p-4 flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-text-primary px-1">技能中心</h3>
      <div className="space-y-0.5">
        {skills.map((s) => (
          <div
            key={s.id}
            onClick={() => useToastStore.getState().addToast(`已选择技能: ${s.name}`, 'info')}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-bg-hover cursor-pointer text-xs"
          >
            <span className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-sm shrink-0">
              {s.icon}
            </span>
            <span className="text-text-primary font-medium truncate">{s.name}</span>
          </div>
        ))}
        {skills.length === 0 && <p className="text-[11px] text-text-muted px-2">加载中...</p>}
      </div>
    </div>
  );
}

export function SkillsCenter() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [skills, setSkills] = useState<Skill[]>([]);
  const [_loading, setLoading] = useState(true);

  useEffect(() => {
    const localP = agentApi
      .listShared()
      .then((res) => (res.rows || []).map(toSkill))
      .catch(() => [] as Skill[]);

    const upstreamP = clawHubApi
      .listSkills()
      .then((res) => (res.items || []).map(upstreamSkillToSkill))
      .catch((err) => {
        console.warn('[SkillsCenter] clawHubApi.listSkills failed:', err);
        return [] as Skill[];
      });

    Promise.all([localP, upstreamP])
      .then(([local, upstream]) => {
        setSkills(mergeSkills(local, upstream));
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = skills;
    if (activeTab !== 'all') {
      list = list.filter((s) => s.category === activeTab);
    }
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(term) ||
          s.desc.toLowerCase().includes(term) ||
          s.roles.some((r) => r.toLowerCase().includes(term))
      );
    }
    return list;
  }, [activeTab, search, skills]);

  return (
    <div className="flex-1 overflow-auto p-6 hmr-scrollbar">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-xl font-bold text-text-primary mb-1">技能中心</h2>
        <p className="text-sm text-text-secondary mb-4">为 Agent 装配专业技能</p>

        {/* Search */}
        <div className="mb-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="搜索技能名称、描述、角色..."
          />
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:bg-bg-hover'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Skill cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <Card key={s.id} hoverable className="p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{s.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary">{s.name}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary font-medium">
                      {s.category === 'general' ? '通用' : '领域'}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted mt-0.5">{s.author}</p>
                </div>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">{s.desc}</p>
              <div className="flex items-center gap-1 flex-wrap">
                {s.roles.map((role) => (
                  <span
                    key={role}
                    className="px-1.5 py-0.5 rounded bg-bg-hover text-[10px] text-text-secondary"
                  >
                    {role}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between mt-1 pt-2 border-t border-border">
                <span className="text-[10px] text-text-muted">
                  {s.usage.toLocaleString()} 次使用
                </span>
                <button
                  type="button"
                  onClick={() =>
                    useToastStore.getState().addToast(`${s.name} 已装配成功`, 'success')
                  }
                  className="text-xs text-primary font-medium hover:underline"
                >
                  装配
                </button>
              </div>
            </Card>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-sm text-text-muted">没有匹配的技能</div>
        )}
      </div>
    </div>
  );
}
