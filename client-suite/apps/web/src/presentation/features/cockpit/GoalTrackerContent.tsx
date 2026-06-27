/**
 * GoalTrackerContent — 目标追踪 Drawer 视图
 *
 * 显示所有用户目标的列表、里程碑进度、进展时间线。
 */
import { useState } from 'react';
import { useCockpitStore } from '../../../application/stores/cockpitStore';
import { Icon } from '../../components/ui/Icon';
import type { GoalStatus, GoalPriority } from '../../../domain/agent/UserGoal';

const STATUS_STYLES: Record<GoalStatus, { label: string; color: string; bg: string }> = {
  active: { label: '进行中', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
  paused: {
    label: '已暂停',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/20',
  },
  completed: { label: '已完成', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  archived: { label: '已归档', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' },
  cancelled: { label: '已取消', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
};

const PRIORITY_DOT: Record<GoalPriority, string> = {
  critical: 'bg-red-400',
  high: 'bg-orange-400',
  normal: 'bg-blue-400',
  low: 'bg-slate-400',
};

const MILESTONE_STATUS: Record<string, { icon: string; color: string }> = {
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

export function GoalTrackerContent() {
  const goals = useCockpitStore((s) => s.goals);
  const activeGoalId = useCockpitStore((s) => s.activeGoalId);
  const setActiveGoalId = useCockpitStore((s) => s.setActiveGoal);

  const activeGoals = goals.filter((g) => g.status === 'active' || g.status === 'paused');
  const completedGoals = goals.filter(
    (g) => g.status === 'completed' || g.status === 'archived' || g.status === 'cancelled'
  );

  return (
    <div className="flex-1 overflow-y-auto hmr-scrollbar px-4 pb-4 space-y-4">
      {goals.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-slate-500">
          <Icon name="flag" size={36} className="text-slate-600 mb-2" />
          <p className="text-xs">暂无进行中的目标</p>
          <p className="text-[10px] mt-1">在对话中设定目标，AI 将自主推进执行</p>
        </div>
      )}

      {/* Active / Paused goals */}
      {activeGoals.length > 0 && (
        <section>
          <div className="flex items-center gap-1.5 mb-2">
            <Icon name="flag" size={14} className="text-primary" />
            <span className="text-xs font-medium text-slate-300">进行中的目标</span>
          </div>
          <div className="space-y-2">
            {activeGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                isActive={goal.id === activeGoalId}
                onSelect={() => setActiveGoalId(goal.id === activeGoalId ? null : goal.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Completed goals */}
      {completedGoals.length > 0 && (
        <section>
          <div className="flex items-center gap-1.5 mb-2">
            <Icon name="task_alt" size={14} className="text-slate-400" />
            <span className="text-xs font-medium text-slate-400">历史目标</span>
          </div>
          <div className="space-y-2">
            {completedGoals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} isActive={false} onSelect={() => {}} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function GoalCard({
  goal,
  isActive,
  onSelect,
}: {
  goal: import('../../../domain/agent/UserGoal').UserGoal;
  isActive: boolean;
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(() => isActive);
  const style = STATUS_STYLES[goal.status];

  return (
    <div
      className={`rounded-lg border transition-colors ${
        isActive
          ? 'border-primary/30 bg-primary/5'
          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
      }`}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => {
          onSelect();
          setExpanded(!expanded);
        }}
        className="w-full px-3 py-2.5 text-left"
      >
        <div className="flex items-start gap-2">
          <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${PRIORITY_DOT[goal.priority]}`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-200 truncate">{goal.title}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 ${style.bg} ${style.color}`}
              >
                {style.label}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[10px] text-slate-500">
                {goal.milestones.filter((m) => m.status === 'completed').length}/
                {goal.milestones.length} 里程碑
              </span>
              {goal.deadline && (
                <span
                  className={`text-[10px] ${goal.isOverdue ? 'text-red-400' : 'text-slate-500'}`}
                >
                  {formatDeadline(goal.deadline)}
                </span>
              )}
            </div>
            {/* Progress bar */}
            <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-green-400 transition-all duration-500"
                style={{ width: `${goal.overallProgress}%` }}
              />
            </div>
          </div>
        </div>
      </button>

      {/* Expanded: milestones + timeline */}
      {expanded && (
        <div className="border-t border-white/10 px-3 py-3 space-y-3">
          {/* Milestones */}
          <div>
            <span className="text-[10px] font-medium text-slate-400 block mb-1.5">里程碑</span>
            <div className="space-y-1">
              {goal.milestones.map((ms, _i) => {
                const msStyle = MILESTONE_STATUS[ms.status];
                return (
                  <div key={ms.id} className="flex items-center gap-2">
                    <Icon name={msStyle.icon} size={14} className={msStyle.color} />
                    <span
                      className={`text-[11px] flex-1 ${ms.status === 'completed' ? 'text-slate-400 line-through' : ms.status === 'active' ? 'text-slate-200 font-medium' : 'text-slate-500'}`}
                    >
                      {ms.name}
                    </span>
                    {ms.completedAt && (
                      <span className="text-[10px] text-slate-600">
                        {formatTimeAgo(ms.completedAt)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Progress timeline (latest 5) */}
          {goal.progressUpdates.length > 0 && (
            <div>
              <span className="text-[10px] font-medium text-slate-400 block mb-1.5">进展</span>
              <div className="space-y-2">
                {goal.progressUpdates
                  .slice(-5)
                  .reverse()
                  .map((update, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/40 mt-1.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          {update.message}
                        </p>
                        <p className="text-[10px] text-slate-600 mt-0.5">
                          {formatTimeAgo(update.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
