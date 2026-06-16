/**
 * OpenClawHeader — 顶部状态栏 (OpenClaw 模式专用)
 * Agent Profile 名称 + 编辑 popover + 渠道状态展示 + 系统状态。
 * 渠道配置操作入口已移至设置页面。
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useOpenClawStore } from '../../../application/stores/openclawStore';
import { useAgentStore } from '../../../application/stores/agentStore';
import { useToastStore } from '../../../application/stores/toastStore';
import { useChannelConfigStore } from '../../../application/stores/channelConfigStore';
import { CHANNEL_TYPE_META } from '../../../domain/agent/ChannelConfig';
import type { ChannelConnection } from '../../../domain/agent/AgentRuntime';
import type { ChannelType } from '../../../domain/shared/types';

const CHANNEL_NAME: Record<ChannelType, string> = {
  matrix: 'Matrix',
  wps: 'WPS',
  websocket: 'WebSocket',
  lark: '飞书',
  dingtalk: '钉钉',
  wecom: '企微',
  email: 'Email',
  webhook: 'Webhook',
  system: 'System',
};

const CHANNEL_COLORS: Record<ChannelConnection['status'], string> = {
  connected: 'bg-green-400',
  disconnected: 'bg-red-400',
  syncing: 'bg-yellow-400',
};

export function OpenClawHeader() {
  const systemHealth = useOpenClawStore((s) => s.systemHealth);
  const primaryAgent = useAgentStore((s) => s.primaryAgent);
  const configuredChannels = useChannelConfigStore((s) => s.channels) ?? [];
  const [clock, setClock] = useState(formatTime());
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', role: '', department: '', persona: '' });
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    useChannelConfigStore.getState().fetchChannels();
  }, []);

  useEffect(() => {
    const tid = setInterval(() => setClock(formatTime()), 1000);
    return () => clearInterval(tid);
  }, []);

  useEffect(() => {
    if (!showEdit) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowEdit(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEdit]);

  const openEdit = useCallback(() => {
    setEditForm({
      name: primaryAgent?.name ?? '',
      role: primaryAgent?.role ?? '',
      department: primaryAgent?.department ?? '',
      persona: primaryAgent?.persona ?? '',
    });
    setShowEdit(true);
  }, [primaryAgent]);

  const saveEdit = useCallback(() => {
    useAgentStore.getState().updatePrimaryAgent(editForm);
    setShowEdit(false);
    useToastStore.getState().addToast('数字分身信息已更新', 'success');
  }, [editForm]);

  const channels = systemHealth?.channelStatuses ?? [];
  const tokenCount = systemHealth?.totalTokenUsage ?? 0;
  const activeCount = systemHealth?.activeAgentCount ?? 0;

  const agentStatusText = activeCount > 0 ? `${activeCount} 运行中` : '空闲';
  const agentStatusColor = activeCount > 0 ? 'text-green-400' : 'text-yellow-400';

  return (
    <header className="h-14 shrink-0 flex items-center justify-between px-5 border-b border-border bg-panel backdrop-blur-[12px]">
      {/* Left */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Icon name="smart_toy" size={20} className="text-primary" />
          <span className="text-sm font-semibold text-text-primary">Almighty</span>
        </div>

        {/* Agent Profile — click to edit */}
        <div className="relative" ref={popoverRef}>
          <button
            type="button"
            onClick={openEdit}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <span className="text-xs text-text-secondary truncate max-w-[120px]">
              {primaryAgent?.name ?? '未配置'}
            </span>
            <Icon name="edit" size={12} className="text-text-muted" />
          </button>

          {showEdit && (
            <div className="absolute top-full left-0 mt-1 w-72 rounded-xl border border-white/10 bg-[#1a1f35] shadow-lg p-4 space-y-2.5 z-50">
              <p className="text-xs font-medium text-slate-300 mb-2">编辑数字分身</p>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="名称"
                className="w-full h-8 px-2.5 rounded-lg border border-white/10 bg-white/5 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-primary/50"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  placeholder="岗位"
                  className="w-full h-8 px-2.5 rounded-lg border border-white/10 bg-white/5 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-primary/50"
                />
                <input
                  type="text"
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  placeholder="部门"
                  className="w-full h-8 px-2.5 rounded-lg border border-white/10 bg-white/5 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-primary/50"
                />
              </div>
              <textarea
                value={editForm.persona}
                onChange={(e) => setEditForm({ ...editForm, persona: e.target.value })}
                placeholder="人设描述"
                rows={2}
                className="w-full px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-primary/50 resize-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowEdit(false)}
                  className="flex-1 h-7 rounded-lg border border-white/10 text-[11px] text-slate-300 hover:bg-white/5 transition-colors"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  className="flex-1 h-7 rounded-lg bg-primary text-[11px] text-white hover:bg-primary-dark transition-colors"
                >
                  保存
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          <span>代理状态:</span>
          <span className={`${agentStatusColor} font-medium`}>{agentStatusText}</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2 text-xs px-2 py-1">
          <span className="text-text-muted">IM 通道:</span>
          {configuredChannels.length > 0
            ? configuredChannels.slice(0, 4).map((ch) => {
                const meta = CHANNEL_TYPE_META[ch.type as keyof typeof CHANNEL_TYPE_META];
                return (
                  <div
                    key={ch.id}
                    className="flex items-center gap-1"
                    title={`${ch.name} — ${ch.enabled ? '已启用' : '已禁用'}`}
                  >
                    <span
                      className={`w-3 h-3 rounded-sm inline-block ${ch.enabled ? 'bg-green-400' : 'bg-red-400'}`}
                    />
                    <span className="text-text-muted text-[10px]">{meta?.label ?? ch.type}</span>
                  </div>
                );
              })
            : channels.map((ch) => (
                <div
                  key={ch.channelType}
                  className="flex items-center gap-1"
                  title={`${CHANNEL_NAME[ch.channelType] ?? ch.channelType} — ${ch.status === 'connected' ? '已连接' : ch.status === 'syncing' ? '同步中' : '断开'}`}
                >
                  <span
                    className={`w-3 h-3 rounded-sm ${CHANNEL_COLORS[ch.status]} inline-block`}
                  />
                  <span className="text-text-muted text-[10px]">
                    {CHANNEL_NAME[ch.channelType] ?? ch.channelType}
                  </span>
                </div>
              ))}
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs bg-primary/12 rounded-full px-2.5 py-1">
          <Icon name="generating_tokens" size={14} className="text-primary" />
          <span className="text-primary font-medium tabular-nums">
            令牌: {tokenCount.toLocaleString()}
          </span>
        </div>
        <div className="h-4 w-px bg-border" />
        <span className="text-xs text-text-muted tabular-nums">{clock}</span>
      </div>
    </header>
  );
}

function formatTime(): string {
  return new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}
