import { useState, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { SearchInput } from '../../components/ui/SearchInput';
import { Avatar } from '../../components/ui/Avatar';
import { useSubscriptionStore } from '../../../application/stores/subscriptionStore';
import { useToastStore } from '../../../application/stores/toastStore';
import type { SidebarTab } from '../../../application/stores/subscriptionStore';
import type { FeedItem } from '../../../domain/subscription/FeedTypes';
import { IntelligenceCard } from './IntelligenceCard';
import { SubscriptionManagerPanel } from './SubscriptionManagerPanel';
import { BriefingDetailPanel } from './BriefingDetailPanel';

const SIDEBAR_TABS: { key: SidebarTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'sources', label: '订阅源' },
  { key: 'alerts', label: '提醒源' },
];

/* ---------- Sidebar ---------- */

export function FeedSidebar() {
  const sidebarTab = useSubscriptionStore((s) => s.sidebarTab);
  const setSidebarTab = useSubscriptionStore((s) => s.setSidebarTab);
  const sources = useSubscriptionStore((s) => s.sources);
  const [search, setSearch] = useState('');

  const filteredSources = sources.filter((src) => {
    if (search && !src.name.includes(search) && !src.description.includes(search)) return false;
    if (sidebarTab === 'all') return true;
    if (sidebarTab === 'sources') return src.type === 'source';
    return src.type === 'alert';
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary">动态</h3>
          <button
            type="button"
            className="p-1 rounded-md text-text-secondary hover:bg-bg-hover transition-colors"
            title="订阅设置"
            onClick={() => useToastStore.getState().addToast('订阅设置即将上线', 'info')}
          >
            <Icon name="settings" size={18} />
          </button>
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="搜索订阅..." />
        <div className="flex items-center gap-0.5">
          {SIDEBAR_TABS.map(({ key, label }) => {
            const active = sidebarTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSidebarTab(key as SidebarTab)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  active ? 'bg-primary text-white' : 'text-text-secondary hover:bg-bg-hover'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Source list */}
      <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {filteredSources.map((src) => (
          <button
            key={src.id}
            type="button"
            onClick={() => useToastStore.getState().addToast(`已选择: ${src.name}`, 'info')}
            className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-bg-hover transition-colors"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: src.iconColor + '14' }}
            >
              <Icon name={src.icon} size={20} style={{ color: src.iconColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary truncate">{src.name}</span>
                {src.hasUnread && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                <span className="text-[10px] text-text-muted ml-auto shrink-0">
                  {src.timestamp}
                </span>
              </div>
              <p className="text-xs text-text-secondary truncate mt-0.5">{src.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Main Page ---------- */

type RightPanel = 'dashboard' | 'manager' | 'briefing' | null;

export function FeedPage() {
  const feedItems = useSubscriptionStore((s) => s.feedItems);
  const feedLoading = useSubscriptionStore((s) => s.feedLoading);
  const [rightPanel, setRightPanel] = useState<RightPanel>(null);

  // Fetch feed items from backend on mount
  useEffect(() => {
    useSubscriptionStore.getState().fetchFromBackend();
  }, []);

  const togglePanel = (panel: RightPanel) => {
    setRightPanel((prev) => (prev === panel ? null : panel));
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Feed content */}
      <div className="flex-1 overflow-y-auto">
        {/* Header bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-bg-white-var/80 backdrop-blur-sm border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">订阅源概览</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="text-xs text-primary font-medium hover:text-primary/80"
              onClick={() => useToastStore.getState().addToast('已全部标记为已读', 'success')}
            >
              标记已读
            </button>
            <button
              type="button"
              onClick={() => togglePanel('manager')}
              className={`p-1.5 rounded-md transition-colors ${
                rightPanel === 'manager'
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-secondary hover:bg-bg-hover'
              }`}
              title="管理订阅"
            >
              <Icon name="tune" size={18} />
            </button>
            <button
              type="button"
              onClick={() => togglePanel('dashboard')}
              className={`p-1.5 rounded-md transition-colors ${
                rightPanel === 'dashboard'
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-secondary hover:bg-bg-hover'
              }`}
              title="订情看板"
            >
              <Icon name="filter_list" size={18} />
            </button>
          </div>
        </div>

        {/* Feed cards */}
        <div className="p-6 space-y-4 max-w-3xl">
          {feedLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-sm text-text-muted">加载中...</span>
            </div>
          ) : (
            feedItems.map((item) => (
              <FeedCard
                key={item.id}
                item={item}
                onViewBriefing={() => setRightPanel('briefing')}
              />
            ))
          )}
        </div>
      </div>

      {/* Right panels */}
      {rightPanel === 'dashboard' && <DashboardPanel onClose={() => setRightPanel(null)} />}
      {rightPanel === 'manager' && <SubscriptionManagerPanel onClose={() => setRightPanel(null)} />}
      {rightPanel === 'briefing' && <BriefingDetailPanel onClose={() => setRightPanel(null)} />}
    </div>
  );
}

/* ---------- Feed Card ---------- */

function FeedCard({ item, onViewBriefing }: { item: FeedItem; onViewBriefing?: () => void }) {
  if (item.cardType === 'jira') return <JiraCard item={item} />;
  if (item.cardType === 'announcement') return <AnnouncementCard item={item} />;
  return <IntelligenceCard item={item} onViewDetail={onViewBriefing} />;
}

function JiraCard({ item }: { item: FeedItem }) {
  const m = item.meta;
  return (
    <div
      onClick={() => useToastStore.getState().addToast('查看 JIRA 任务详情', 'info')}
      className="bg-bg-white-var rounded-xl border border-border p-4 hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon name="bug_report" size={18} className="text-primary" />
        </div>
        <span className="text-xs font-semibold text-text-secondary">JIRA 更新</span>
        <span className="px-1.5 py-0.5 rounded bg-primary text-white text-[10px] font-bold">
          NEW
        </span>
        <span className="text-[10px] text-text-muted ml-auto">
          {formatRelative(item.timestamp)}
        </span>
      </div>

      <h3 className="text-sm font-semibold text-text-primary mb-1">{item.title}</h3>
      <p className="text-xs text-text-secondary mb-3">
        {m?.assignee} 将任务状态从{' '}
        <span className="text-text-primary font-medium">{m?.statusFrom}</span> 变更为
      </p>

      {m?.isCompleted && (
        <div className="flex items-center gap-1.5 mb-3">
          <Icon name="check_circle" size={16} className="text-success" />
          <span className="text-xs font-medium text-success">已完成</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-border">
        <div className="flex items-center gap-4 text-[11px] text-text-muted">
          <span className="flex items-center gap-1">
            <Icon name="thumb_up" size={14} /> {m?.likeCount ?? 0}
          </span>
          <span className="flex items-center gap-1">
            <Icon name="chat_bubble_outline" size={14} /> {m?.commentCount ?? 0} 条评论
          </span>
        </div>
        <button
          type="button"
          onClick={() => useToastStore.getState().addToast('查看详情功能开发中', 'info')}
          className="text-xs text-primary font-medium hover:text-primary/80 flex items-center gap-0.5"
        >
          查看详情 <Icon name="chevron_right" size={14} />
        </button>
      </div>
    </div>
  );
}

function AnnouncementCard({ item }: { item: FeedItem }) {
  return (
    <div
      onClick={() => useToastStore.getState().addToast('查看公司公告详情', 'info')}
      className="bg-bg-white-var rounded-xl border border-border overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <div className="w-8 h-8 rounded-lg bg-error/10 flex items-center justify-center">
          <Icon name="campaign" size={18} className="text-error" />
        </div>
        <span className="text-xs font-semibold text-text-secondary">公司公告</span>
        <span className="text-[10px] text-text-muted ml-auto">
          {formatRelative(item.timestamp)}
        </span>
      </div>
      {/* Placeholder image area */}
      <div className="mx-4 mb-4 h-48 rounded-xl bg-gradient-to-br from-[#e8f5e9] to-[#c8e6c9] flex items-center justify-center">
        <span className="text-lg font-bold text-[#2e7d32]/60 tracking-widest">PRODUCT TEAM</span>
      </div>
      <div className="px-4 pb-3 flex items-center justify-between">
        <span className="text-xs text-success font-medium flex items-center gap-1">
          <Icon name="auto_awesome" size={14} />
          置顶通知
        </span>
      </div>
    </div>
  );
}

/* ---------- Dashboard Panel ---------- */

function DashboardPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="w-72 border-l border-border bg-bg-secondary overflow-y-auto flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-text-primary">订情看板</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-text-secondary hover:bg-bg-hover"
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      <div className="p-4 space-y-5">
        {/* Team members */}
        <section>
          <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3">
            团队成员
          </h4>
          <div className="space-y-2">
            <MemberRow name="Sarah Chen" status="在线" online />
            <MemberRow name="Alex Rivera" status="离线" online={false} />
          </div>
        </section>

        {/* Tools */}
        <section>
          <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-3">
            常用工具
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <ToolButton icon="inventory_2" label="资产" />
            <ToolButton icon="dashboard" label="看板" />
          </div>
        </section>

        {/* AI Insight */}
        <section>
          <div className="bg-primary/8 border border-primary/20 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Icon name="auto_awesome" size={14} className="text-primary" />
              <span className="text-xs font-semibold text-primary">智能洞察</span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              订阅源 "Jira Cloud" 频繁推送了百条动态，该项目目前活跃度较高。
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function MemberRow({ name, status, online }: { name: string; status: string; online: boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-2 py-1.5">
      <div className="relative">
        <Avatar letter={name.charAt(0)} size={32} />
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-bg-secondary ${
            online ? 'bg-success' : 'bg-border'
          }`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium text-text-primary">{name}</span>
      </div>
      <span className={`text-[10px] ${online ? 'text-success' : 'text-text-muted'}`}>{status}</span>
    </div>
  );
}

function ToolButton({ icon, label }: { icon: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => useToastStore.getState().addToast(`${label}功能开发中`, 'info')}
      className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-border bg-bg-white-var hover:bg-bg-hover transition-colors"
    >
      <Icon name={icon} size={20} className="text-primary" />
      <span className="text-[11px] text-text-secondary font-medium">{label}</span>
    </button>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 1) return '刚刚';
  if (diffH < 24) return `${diffH}小时前`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}天前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
