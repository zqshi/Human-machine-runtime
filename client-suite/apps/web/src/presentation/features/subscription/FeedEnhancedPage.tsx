/**
 * FeedEnhancedPage — 增强版订阅动态页 (stitch_23 对齐)
 * 左侧: 订阅源列表 (Jira/公告/GitHub)
 * 中间: 动态卡片流 (JIRA更新/公司公告)
 * 右侧: 详情看板 (成员/工具/智能洞察)
 */
import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useToastStore } from '../../../application/stores/toastStore';

interface FeedSource {
  name: string;
  icon: string;
  time: string;
  preview: string;
  unread?: boolean;
}

const SOURCES: FeedSource[] = [
  { name: 'Jira Cloud', icon: 'bug_report', time: '刚刚', preview: '同步 7 条最新动态', unread: true },
  { name: '公司公告', icon: 'campaign', time: '上午 10:45', preview: '适合办公场景更新...' },
  { name: 'GitHub', icon: 'code', time: '4小时前', preview: 'feat/dark-mode 已合并' },
];

interface FeedEnhancedPageProps {
  onClose?: () => void;
}

export function FeedEnhancedPage({ onClose }: FeedEnhancedPageProps) {
  const [showToast, setShowToast] = useState(true);
  const [selectedSource, setSelectedSource] = useState('Jira Cloud');
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState(1);

  return (
    <div className="flex-1 flex overflow-hidden bg-bg-white-var relative">
      {/* Success toast */}
      {showToast && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full bg-success text-white text-xs font-medium shadow-lg flex items-center gap-2 dcf-fade-in">
          <Icon name="check_circle" size={14} />
          订阅成功！已同步最新动态
          <button type="button" onClick={() => setShowToast(false)} className="ml-1">
            <Icon name="close" size={12} />
          </button>
        </div>
      )}

      {/* Left source list */}
      <div className="w-52 border-r border-border flex flex-col">
        <div className="flex items-center justify-between px-3 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-text-primary">动态</h3>
          <button type="button" onClick={() => useToastStore.getState().addToast('订阅设置功能开发中', 'info')} className="p-1 text-text-muted hover:text-text-secondary">
            <Icon name="settings" size={16} />
          </button>
        </div>

        <div className="px-3 py-2">
          <div className="relative">
            <Icon name="search" size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="搜索订阅..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-7 pr-2 py-1.5 text-[11px] border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 px-3 mb-2">
          {['全部', '订阅源', '提醒我'].map((tab, i) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveFilter(i)}
              className={`px-2 py-1 text-[10px] rounded-md ${
                activeFilter === i ? 'bg-primary text-white font-medium' : 'text-text-muted hover:bg-bg-hover'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {SOURCES.map((src) => (
            <button
              key={src.name}
              type="button"
              onClick={() => setSelectedSource(src.name)}
              className={`w-full text-left px-3 py-2.5 transition-colors ${
                selectedSource === src.name ? 'bg-primary/5 border-l-2 border-primary' : 'hover:bg-bg-hover/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon name={src.icon} size={16} className="text-primary" />
                <span className="text-xs font-medium text-text-primary flex-1">{src.name}</span>
                {src.unread && <span className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              <p className="text-[10px] text-text-muted mt-0.5 pl-6 truncate">{src.preview}</p>
              <p className="text-[10px] text-text-muted pl-6">{src.time}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Center feed cards */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-end gap-2 px-4 py-2 border-b border-border">
          <button type="button" onClick={() => useToastStore.getState().addToast('已全部标记为已读', 'success')} className="text-xs text-primary hover:underline">标记已读</button>
          <button type="button" onClick={() => useToastStore.getState().addToast('筛选功能开发中', 'info')} className="p-1 text-text-muted"><Icon name="filter_list" size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* JIRA update card */}
          <div onClick={() => useToastStore.getState().addToast('查看 JIRA 更新详情', 'info')} className="rounded-2xl border border-border p-4 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon name="bug_report" size={16} className="text-primary" />
              </div>
              <span className="text-xs font-semibold text-text-primary">JIRA 更新</span>
              <span className="px-1.5 py-0.5 text-[8px] font-medium text-primary bg-primary/10 rounded">NEW</span>
              <span className="ml-auto text-[10px] text-text-muted">刚刚</span>
            </div>
            <p className="text-sm font-medium text-text-primary mb-2">PROD-2048: 移动端订阅功能优化</p>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-full bg-warning/20 flex items-center justify-center text-[8px] font-bold text-warning">S</div>
              <span className="text-xs text-text-secondary">Sarah Chen 将任务状态从 "进行中" 变更为</span>
              <span className="px-1.5 py-0.5 text-[9px] font-medium text-success bg-success/10 rounded-full">已完成</span>
            </div>
            <div className="flex items-center gap-4 text-[10px] text-text-muted">
              <span className="flex items-center gap-1"><Icon name="thumb_up" size={12} /> 48</span>
              <span className="flex items-center gap-1"><Icon name="comment" size={12} /> 32 条评论</span>
              <button type="button" onClick={() => useToastStore.getState().addToast('查看详情功能开发中', 'info')} className="text-primary hover:underline">查看详情</button>
            </div>
          </div>

          {/* Company announcement card */}
          <div onClick={() => useToastStore.getState().addToast('查看公司公告详情', 'info')} className="rounded-2xl border border-border p-4 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-error/10 flex items-center justify-center">
                <Icon name="campaign" size={16} className="text-error" />
              </div>
              <span className="text-xs font-semibold text-text-primary">公司公告</span>
              <span className="ml-auto text-[10px] text-text-muted">上午 10:45</span>
            </div>
            <div className="w-full h-40 rounded-xl bg-gradient-to-br from-[#34C759]/20 to-[#007AFF]/20 flex items-center justify-center mb-3">
              <span className="text-sm text-text-muted">PRODUCT TEAM</span>
            </div>
            <span className="px-2 py-0.5 text-[9px] font-medium text-error bg-error/10 rounded-full">重要通知</span>
          </div>
        </div>
      </div>

      {/* Right detail board */}
      <div className="w-60 border-l border-border flex flex-col">
        <div className="flex items-center justify-between px-3 py-3 border-b border-border">
          <h4 className="text-xs font-semibold text-text-primary">详情看板</h4>
          <button type="button" onClick={onClose} className="p-0.5 text-text-muted hover:text-text-secondary">
            <Icon name="close" size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Members */}
          <section>
            <h5 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">当前成员</h5>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="w-7 h-7 rounded-full bg-warning/20 flex items-center justify-center text-[10px] font-bold text-warning">S</div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success border-2 border-white" />
                </div>
                <div>
                  <p className="text-xs text-text-primary">Sarah Chen</p>
                  <p className="text-[10px] text-success">在线</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">A</div>
                <div>
                  <p className="text-xs text-text-primary">Alex Rivera</p>
                  <p className="text-[10px] text-text-muted">离线</p>
                </div>
              </div>
            </div>
          </section>

          {/* Quick tools */}
          <section>
            <h5 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">常用工具</h5>
            <div className="flex gap-2">
              <button type="button" onClick={() => useToastStore.getState().addToast('资产管理功能开发中', 'info')} className="px-3 py-1.5 text-[10px] text-primary bg-primary/10 rounded-lg flex items-center gap-1">
                <Icon name="folder" size={12} /> 资产
              </button>
              <button type="button" onClick={() => useToastStore.getState().addToast('看板功能开发中', 'info')} className="px-3 py-1.5 text-[10px] text-primary bg-primary/10 rounded-lg flex items-center gap-1">
                <Icon name="dashboard" size={12} /> 看板
              </button>
            </div>
          </section>

          {/* AI insight */}
          <section>
            <h5 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">智能洞察</h5>
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon name="auto_awesome" size={12} className="text-primary" />
                <span className="text-[10px] font-medium text-primary">AI 分析</span>
              </div>
              <p className="text-[10px] text-text-secondary leading-relaxed">
                订阅源 &apos;Jira Cloud&apos; 频繁推送了百条动态，该项目目前活跃度较高。
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
