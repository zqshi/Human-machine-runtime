/**
 * SituationPanel — 态势感知面板（中栏默认视图）
 *
 * 当左栏没有选中任何事件时，展示全局态势：
 * - 今日处理统计
 * - 进行中任务
 * - Agent 建议的待确认项
 */
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useNotificationStore, selectCrossChannelNotifications, selectNeedsHumanCount } from '../../../application/stores/notificationStore';
import { useOpenClawStore } from '../../../application/stores/openclawStore';
import { useAgentChat } from '../../../application/hooks/useAgentChat';
import { Icon } from '../../components/ui/Icon';

export function SituationPanel() {
  const notifications = useNotificationStore(useShallow(selectCrossChannelNotifications));
  const needsHumanCount = useNotificationStore(selectNeedsHumanCount);
  const selectNotification = useNotificationStore((s) => s.selectNotification);
  const tasks = useOpenClawStore((s) => s.tasks);
  const { sendMessage, isSending } = useAgentChat();
  const [input, setInput] = useState('');

  const totalCount = notifications.length;
  const autoHandledCount = notifications.filter(n => n.isAutoHandled).length;
  const agentHandledPercent = totalCount > 0 ? Math.round((autoHandledCount / totalCount) * 100) : 0;

  // Pending agent suggestions (notifications with draftReply that need confirmation)
  const pendingSuggestions = notifications.filter(n => n.isNeedsHuman && n.agentReaction?.draftReply);
  const activeTasks = tasks.filter(t => t.status === 'running' || t.status === 'paused');

  const handleSuggestionClick = (id: string) => {
    selectNotification(id);
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    sendMessage(text);
    setInput('');
  };

  const handleTaskClick = (taskId: string) => {
    useOpenClawStore.getState().selectTask(taskId);
  };

  if (totalCount === 0 && needsHumanCount === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
        <Icon name="verified_user" size={48} className="text-green-500/40 mb-3" />
        <p className="text-sm text-slate-400 mb-1">一切正常</p>
        <p className="text-xs text-slate-600">Agent 已接管全部消息处理</p>
        <div className="mt-8 w-[80%] max-w-md">
          <SituationInput input={input} setInput={setInput} onSend={handleSend} disabled={isSending} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Content */}
      <div className="flex-1 overflow-y-auto hmr-scrollbar px-6 py-5 space-y-5">
        {/* Today's stats */}
        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="assessment" size={16} className="text-primary" />
            <span className="text-xs font-semibold text-slate-200">今日态势</span>
            <span className="text-[10px] text-slate-500 ml-auto">
              {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })}
            </span>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs text-slate-400">
              收到 {totalCount} 条消息
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-green-400 transition-all duration-500"
              style={{ width: `${agentHandledPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-slate-500">
              Agent 已处理 {agentHandledPercent}%
            </span>
            <span className="text-[10px] text-slate-500">
              {needsHumanCount} 条待确认 · {pendingSuggestions.length} 条有建议
            </span>
          </div>
        </section>

        {/* Active tasks */}
        {activeTasks.length > 0 && (
          <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="target" size={16} className="text-primary" />
              <span className="text-xs font-semibold text-slate-200">进行中</span>
            </div>
            <div className="space-y-2.5">
              {activeTasks.slice(0, 4).map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => handleTaskClick(task.id)}
                  className="w-full text-left flex items-center gap-3 group"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: task.color + '20' }}>
                    <span className="text-xs font-bold" style={{ color: task.color }}>{task.progress}%</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-200 truncate group-hover:text-primary transition-colors">{task.name}</p>
                    <div className="w-full h-1 rounded-full bg-white/[0.06] mt-1 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${task.status === 'running' ? 'animate-pulse' : ''}`}
                        style={{ width: `${task.progress}%`, backgroundColor: task.color }}
                      />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Agent suggestions */}
        {pendingSuggestions.length > 0 && (
          <section className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="lightbulb" size={16} className="text-primary" />
              <span className="text-xs font-semibold text-slate-200">Agent 建议</span>
            </div>
            <div className="space-y-3">
              {pendingSuggestions.slice(0, 3).map((n) => (
                <div key={n.id} className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="w-2 h-2 rounded-sm shrink-0"
                      style={{ backgroundColor: CHANNEL_COLORS[n.channel ?? ''] ?? '#64748b' }}
                    />
                    <span className="text-xs font-medium text-slate-200">{n.sender.name}</span>
                    <span className="text-[10px] text-slate-500">{n.body}</span>
                  </div>
                  {n.agentReaction?.draftReply && (
                    <p className="text-[11px] text-primary/70 italic line-clamp-2 mb-2">
                      &ldquo;{n.agentReaction.draftReply}&rdquo;
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleSuggestionClick(n.id)}
                      className="text-[10px] text-primary hover:text-primary/80 transition-colors"
                    >
                      查看详情
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Bottom input */}
      <SituationInput input={input} setInput={setInput} onSend={handleSend} disabled={isSending} />
    </div>
  );
}

/** Shared bottom input for situation panel */
const CHANNEL_COLORS: Record<string, string> = {
  lark: '#34C759', email: '#007AFF', slack: '#FF3B30',
  matrix: '#AF52DE', wechat: '#07C160', teams: '#6264A7',
};

function SituationInput({ input, setInput, onSend, disabled }: {
  input: string; setInput: (v: string) => void; onSend: () => void; disabled: boolean;
}) {
  return (
    <div className="border-t border-white/10 px-6 py-3">
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
        <Icon name="smart_toy" size={16} className="text-primary/40 shrink-0" />
        <input
          type="text"
          placeholder="向 Agent 下达指令或提问..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.nativeEvent.isComposing || e.keyCode === 229) return; if (e.key === 'Enter' && !e.shiftKey) onSend(); }}
          disabled={disabled}
          className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 outline-none disabled:opacity-40"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={!input.trim() || disabled}
          className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white hover:bg-primary-dark transition-colors disabled:opacity-40"
        >
          <Icon name="send" size={16} />
        </button>
      </div>
    </div>
  );
}
