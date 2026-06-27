/**
 * AgentsHub — Agent Team 大厅
 *
 * 在 Almighty 模式下展示可用数字员工：
 * - 分类筛选：我的 / 部门 / 组织
 * - 点击「对话」跳转消息页打开 bot room
 * - 点击卡片查看详情（职责/能力/统计）
 */
import { useState, useEffect, useCallback } from 'react';
import { Icon } from '../../components/ui/Icon';
import { AgentCard } from './AgentCard';
import { useAgentStore } from '../../../application/stores/agentStore';
import { useCockpitStore } from '../../../application/stores/cockpitStore';
import { getMatrixClient, globalSelectRoom } from '../../../application/hooks/useMatrixClient';
import { useUIStore } from '../../../application/stores/uiStore';
import { useChatStore } from '../../../application/stores/chatStore';
import { useToastStore } from '../../../application/stores/toastStore';
import { SharedAgentChatView } from './SharedAgentChatView';
import { sharedAgentChatService } from '../../../application/services/sharedAgentChatService';

type Scope = 'all' | 'personal' | 'department';

const SCOPE_TABS: { key: Scope; label: string; icon: string }[] = [
  { key: 'all', label: '全部', icon: 'groups' },
  { key: 'personal', label: '个人', icon: 'person' },
  { key: 'department', label: '部门', icon: 'apartment' },
];

export function AgentsHub() {
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const sharedAgents = useAgentStore((s) => s.sharedAgents);
  const loadPersistedAgents = useAgentStore((s) => s.loadPersistedAgents);
  const setDock = useUIStore((s) => s.setDock);
  const appMode = useUIStore((s) => s.appMode);
  const imChatAgentId = useUIStore((s) => s.imChatAgentId);
  const isOC = appMode === 'cockpit';

  useEffect(() => {
    loadPersistedAgents();
  }, [loadPersistedAgents]);

  const handleChat = useCallback(
    (agentId: string, agentUserId?: string, agentName?: string) => {
      // Almighty 模式：留 Almighty 内置对话，不跳 IM 消息
      if (appMode === 'cockpit') {
        useCockpitStore.getState().setSharedAgentMeta(agentId, agentName ?? 'Agent');
        useCockpitStore.getState().startSharedAgentChat(agentId);
        setDock('cockpit');
        return;
      }

      // IM 模式 + 有 Matrix 账号：走 IM 消息 DM（打开 bot room）
      if (agentUserId) {
        const rooms = useChatStore.getState().rooms;
        const localpart = agentUserId.split(':')[0].slice(1);
        const existing = rooms.find(
          (r) => r.type === 'bot' && (r.name === localpart || r.name === agentUserId)
        );

        if (existing) {
          setDock('messages');
          useChatStore.getState().setRoomFilter('all');
          globalSelectRoom(existing.id);
          return;
        }

        const client = getMatrixClient();
        if (client) {
          client
            .createDmRoom(agentUserId)
            .then((roomId) => {
              if (roomId) {
                setDock('messages');
                useChatStore.getState().setRoomFilter('all');
                globalSelectRoom(roomId);
              }
            })
            .catch(() => {
              useToastStore.getState().addToast('创建对话失败', 'error');
            });
          return;
        }
      }

      // IM 模式 + 无 Matrix 账号：IM 内本地对话（不跳 Almighty 工作面板）
      sharedAgentChatService.open(agentId, agentName ?? 'Agent');
      useToastStore.getState().addToast(`已打开与「${agentName ?? 'Agent'}」的对话`, 'info');
    },
    [setDock, appMode]
  );

  const filtered = sharedAgents.filter((a) => {
    if (
      search &&
      !a.name.toLowerCase().includes(search.toLowerCase()) &&
      !a.role.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    if (scope === 'personal') return a.creator === 'me' || a.category === 'personal';
    if (scope === 'department') return a.category === 'department';
    return true;
  });

  // ─── 暗色主题 (Almighty) ───
  if (isOC) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header — 与 Studio/共享中心 一致 */}
        <header className="shrink-0 px-6 pt-5 pb-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-bold text-slate-100">Agent Team</h1>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 搜索数字员工..."
              className="w-52 h-8 px-3 text-xs border border-white/[0.1] bg-white/[0.04] rounded-lg text-slate-200 placeholder:text-slate-500 outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          {/* Scope tabs */}
          <div className="flex items-center gap-1">
            {SCOPE_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setScope(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${
                  scope === tab.key
                    ? 'bg-primary text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
                }`}
              >
                <Icon name={tab.icon} size={12} />
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 hmr-scrollbar">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Icon name="smart_toy" size={40} className="opacity-30 mx-auto mb-2" />
              <p className="text-sm">
                {search ? `没有匹配 "${search}" 的数字员工` : '暂无可用数字员工'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((agent) => (
                <div
                  key={agent.id}
                  className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.15] transition-all group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-primary/20 flex items-center justify-center shrink-0">
                      <Icon name={agent.icon || 'smart_toy'} size={20} className="text-slate-200" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-slate-100 truncate">
                        {agent.name}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {agent.role || agent.category || '—'}
                      </div>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="在线" />
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 mb-3 min-h-[30px]">
                    {agent.tags?.join(' · ') || agent.description || '通用 AI 助手'}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleChat(agent.id, agent.userId, agent.name)}
                      className="flex-1 h-7 rounded-lg text-[11px] font-medium bg-primary text-white hover:opacity-90 transition-opacity"
                    >
                      对话
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // IM 模式下打开共享 Agent 对话视图（无 Matrix 账号的 Agent）
  if (!isOC && imChatAgentId) {
    return <SharedAgentChatView />;
  }

  // ─── IM 模式（浅色） ───
  return (
    <div className="flex-1 overflow-auto hmr-scrollbar">
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Agent Team</h2>
          <div className="relative">
            <Icon
              name="search"
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索数字员工..."
              className="pl-9 pr-3 py-2 w-48 text-sm border border-border rounded-xl bg-fill-tertiary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 placeholder:text-text-muted/60"
            />
          </div>
        </div>

        {/* Scope tabs */}
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-black/[0.04]">
          {SCOPE_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setScope(tab.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                scope === tab.key
                  ? 'bg-white text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-text-muted">
            <Icon name="smart_toy" size={40} className="opacity-30 mx-auto mb-2" />
            <p className="text-sm">
              {search ? `没有匹配 "${search}" 的数字员工` : '暂无可用数字员工'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onClick={() => handleChat(agent.id, agent.userId, agent.name)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
