/**
 * GoalDetailPanel — B 栏目标详情面板
 *
 * 展示目标进度、里程碑、关联决策/任务、进展时间线。
 * 从 GoalTrackerContent（drawer 版）提取，适配 B 栏 320px。
 */
import { useOpenClawStore } from '../../../application/stores/openclawStore';
import { Icon } from '../../components/ui/Icon';
import type { GoalStatus, GoalPriority } from '../../../domain/agent/UserGoal';

const STATUS_STYLES: Record<GoalStatus, { label: string; color: string }> = {
  active: { label: '进行中', color: 'text-green-400' },
  paused: { label: '已暂停', color: 'text-yellow-400' },
  completed: { label: '已完成', color: 'text-blue-400' },
  archived: { label: '已归档', color: 'text-slate-400' },
  cancelled: { label: '已取消', color: 'text-red-400' },
};

const PRIORITY_STYLES: Record<GoalPriority, { dot: string; label: string }> = {
  critical: { dot: 'bg-red-400', label: '紧急' },
  high: { dot: 'bg-orange-400', label: '重要' },
  normal: { dot: 'bg-blue-400', label: '普通' },
  low: { dot: 'bg-slate-400', label: '低' },
};

const MILESTONE_ICONS: Record<string, { icon: string; color: string }> = {
  completed: { icon: 'check_circle', color: 'text-green-400' },
  active: { icon: 'radio_button_checked', color: 'text-primary' },
  pending: { icon: 'radio_button_unchecked', color: 'text-slate-500' },
};

function formatTimeAgo(ts: number): string {
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

function formatDeadline(ts: number): string {
  const diff = ts - Date.now();
  const days = Math.ceil(diff / 86_400_000);
  if (days < 0) return `已逾期 ${Math.abs(days)} 天`;
  if (days === 0) return '今天截止';
  if (days === 1) return '明天截止';
  return `${days} 天后截止`;
}

export function GoalDetailPanel() {
  const bColumnGoalId = useOpenClawStore((s) => s.bColumnGoalId);
  const goals = useOpenClawStore((s) => s.goals);
  const decisionRequests = useOpenClawStore((s) => s.decisionRequests);
  const tasks = useOpenClawStore((s) => s.tasks);
  const selectBColumnDecision = useOpenClawStore((s) => s.selectBColumnDecision);
  const selectBColumnTask = useOpenClawStore((s) => s.selectBColumnTask);
  const selectBColumnGoal = useOpenClawStore((s) => s.selectBColumnGoal);

  const goal = goals.find((g) => g.id === bColumnGoalId);

  if (!goal) return null;

  const close = () => selectBColumnGoal(null);
  const statusStyle = STATUS_STYLES[goal.status];
  const priorityStyle = PRIORITY_STYLES[goal.priority];

  // Resolve related decisions and tasks
  const relatedDecisions = goal.relatedDecisionIds
    ? decisionRequests.filter((d) => goal.relatedDecisionIds!.includes(d.id))
    : [];
  const relatedTasks = goal.relatedTaskIds
    ? tasks.filter((t) => goal.relatedTaskIds!.includes(t.id))
    : [];

  return (
    <div className="w-[320px] shrink-0 border-r border-white/10 flex flex-col bg-glass-sidebar backdrop-blur-[20px] overflow-hidden animate-[slideInLeft_0.2s_ease-out]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${priorityStyle.dot}`} />
        <span className="text-xs font-semibold text-slate-200 truncate flex-1">{goal.title}</span>
        <span className={`text-[9px] ${statusStyle.color}`}>{statusStyle.label}</span>
        <button
          type="button"
          onClick={close}
          className="w-6 h-6 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors shrink-0"
        >
          <Icon name="close" size={16} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto dcf-scrollbar px-4 py-3 space-y-3">
        {/* Description + deadline */}
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2.5 space-y-2">
          <p className="text-xs text-slate-300 leading-relaxed">{goal.description}</p>
          <div className="flex items-center gap-3 text-[10px] text-slate-500">
            {goal.deadline && (
              <span className={goal.isOverdue ? 'text-red-400' : ''}>
                <Icon name="event" size={10} className="inline mr-0.5" />
                {formatDeadline(goal.deadline)}
              </span>
            )}
            <span>
              <Icon name="trending_up" size={10} className="inline mr-0.5" />
              {goal.overallProgress}%
            </span>
          </div>
          {/* Overall progress bar */}
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-green-400 transition-all duration-500"
              style={{ width: `${goal.overallProgress}%` }}
            />
          </div>
        </div>

        {/* Milestones */}
        {goal.milestones.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Icon name="flag" size={12} className="text-slate-500" />
              <span className="text-[10px] font-medium text-slate-400">里程碑</span>
              <span className="text-[9px] text-slate-600">
                {goal.milestones.filter((m) => m.status === 'completed').length}/{goal.milestones.length}
              </span>
            </div>
            <div className="space-y-1.5">
              {goal.milestones.map((ms) => {
                const msStyle = MILESTONE_ICONS[ms.status];
                return (
                  <div key={ms.id} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-white/[0.03] transition-colors">
                    <Icon name={msStyle.icon} size={14} className={msStyle.color} />
                    <span className={`text-[11px] flex-1 ${
                      ms.status === 'completed' ? 'text-slate-400 line-through'
                      : ms.status === 'active' ? 'text-slate-200 font-medium'
                      : 'text-slate-500'
                    }`}>
                      {ms.name}
                    </span>
                    {ms.completedAt && (
                      <span className="text-[9px] text-slate-600">{formatTimeAgo(ms.completedAt)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Related decisions */}
        {relatedDecisions.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Icon name="bolt" size={12} className="text-orange-400/70" />
              <span className="text-[10px] font-medium text-slate-400">关联决策</span>
            </div>
            <div className="space-y-1">
              {relatedDecisions.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => selectBColumnDecision(d.id)}
                  className="w-full text-left rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 hover:bg-white/[0.05] transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      d.urgency === 'critical' ? 'bg-red-400' : d.urgency === 'high' ? 'bg-orange-400' : 'bg-yellow-400'
                    }`} />
                    <span className="text-[11px] text-slate-300 truncate">{d.title}</span>
                  </div>
                  <span className={`text-[9px] ml-3.5 ${
                    d.responseStatus === 'pending' ? 'text-orange-400' : 'text-slate-500'
                  }`}>
                    {d.responseStatus === 'pending' ? '待决策' : '已处理'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Related tasks */}
        {relatedTasks.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Icon name="pending_actions" size={12} className="text-primary/70" />
              <span className="text-[10px] font-medium text-slate-400">关联任务</span>
            </div>
            <div className="space-y-1">
              {relatedTasks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => selectBColumnTask(t.id)}
                  className="w-full text-left rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 hover:bg-white/[0.05] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-300 truncate flex-1">{t.name}</span>
                    <span className="text-[9px] text-slate-500 shrink-0">{t.progress}%</span>
                  </div>
                  <div className="h-0.5 rounded-full bg-white/10 overflow-hidden mt-1">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${t.progress}%`, backgroundColor: t.color ?? 'rgb(var(--c-primary))' }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Progress timeline */}
        {goal.progressUpdates.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Icon name="timeline" size={12} className="text-slate-500" />
              <span className="text-[10px] font-medium text-slate-400">进展时间线</span>
            </div>
            <div className="space-y-2">
              {goal.progressUpdates.slice(-10).reverse().map((update, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/40 mt-1.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-slate-300 leading-relaxed">{update.message}</p>
                    <p className="text-[9px] text-slate-600 mt-0.5">{formatTimeAgo(update.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
