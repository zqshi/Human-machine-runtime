/**
 * GoalInitPage — C 栏目标讨论上下文卡片
 *
 * 当 discussingGoalId 非空时渲染在 C 栏对话流顶部。
 * 支持：目标概览 → 智能分解 → 任务分配 → 风险分析 → 确认下发。
 */
import { useMemo, useState, useCallback } from 'react';
import { useCockpitStore } from '../../../application/stores/cockpitStore';
import { Icon } from '../../components/ui/Icon';
import { GoalDecomposePanel } from './GoalDecomposePanel';
import { TaskAssignmentPanel } from './TaskAssignmentPanel';
import { RiskAnalysisPanel } from './RiskAnalysisPanel';
import type { GoalStatus, GoalPriority } from '../../../domain/agent/UserGoal';
import type { CockpitDrawerContent } from '../../../domain/agent/DrawerContent';
import type { DecomposeResult, TaskAssignment } from '../../../domain/agent/ICockpitDataSource';

type DecomposePhase = 'idle' | 'decompose' | 'assign' | 'risk' | 'confirm';

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

function formatDeadline(ts: number): string {
  const diff = ts - Date.now();
  const days = Math.ceil(diff / 86_400_000);
  if (days < 0) return `已逾期 ${Math.abs(days)} 天`;
  if (days === 0) return '今天截止';
  if (days === 1) return '明天截止';
  return `${days} 天后截止`;
}

interface GoalInitPageProps {
  onOpenDrawer?: (content: CockpitDrawerContent) => void;
}

export function GoalInitPage({ onOpenDrawer }: GoalInitPageProps) {
  const discussingGoalId = useCockpitStore((s) => s.discussingGoalId);
  const goals = useCockpitStore((s) => s.goals);
  const _decisionRequests = useCockpitStore((s) => s.decisionRequests);
  const _tasks = useCockpitStore((s) => s.tasks);

  const [collapsed, setCollapsed] = useState(false);
  const [decomposing, setDecomposing] = useState(false);
  const [decomposeResult, setDecomposeResult] = useState<DecomposeResult | null>(null);
  const [phase, setPhase] = useState<DecomposePhase>('idle');
  const [dispatching, setDispatching] = useState(false);

  // Editable state derived from decompose result
  const [editTasks, setEditTasks] = useState<
    Array<{ id: string; name: string; agentId: string; [k: string]: unknown }>
  >([]);
  const [editMilestones, setEditMilestones] = useState<
    Array<{ id: string; name: string; [k: string]: unknown }>
  >([]);
  const [editAssignments, setEditAssignments] = useState<TaskAssignment[]>([]);

  const handleDecompose = useCallback(
    async (apply: boolean) => {
      if (!discussingGoalId || decomposing) return;
      setDecomposing(true);
      try {
        const result = await useCockpitStore.getState().decomposeGoal(discussingGoalId, apply);
        setDecomposeResult(result);
        if (!apply) {
          const sugTasks = (result.suggestedTasks ?? []).map((t) => ({
            id: String((t as Record<string, unknown>).id ?? `task-${Date.now()}`),
            name: String((t as Record<string, unknown>).name ?? ''),
            agentId: String((t as Record<string, unknown>).agentId ?? 'dev-assistant'),
            ...t,
          }));
          setEditTasks(sugTasks);
          setEditMilestones(
            (result.suggestedMilestones ?? []).map((m) => ({
              id: String((m as Record<string, unknown>).id ?? `ms-${Date.now()}`),
              name: String((m as Record<string, unknown>).name ?? ''),
              ...m,
            }))
          );
          setEditAssignments(result.assignments ?? []);
          setPhase('decompose');
        }
      } finally {
        setDecomposing(false);
      }
    },
    [discussingGoalId, decomposing]
  );

  const handleDispatch = useCallback(async () => {
    if (!discussingGoalId || dispatching) return;
    setDispatching(true);
    try {
      await useCockpitStore
        .getState()
        .dispatchGoalPlan(discussingGoalId, editTasks, editAssignments);
      setPhase('idle');
      setDecomposeResult(null);
    } finally {
      setDispatching(false);
    }
  }, [discussingGoalId, dispatching, editTasks, editAssignments]);

  const goal = useMemo(
    () => goals.find((g) => g.id === discussingGoalId),
    [goals, discussingGoalId]
  );

  if (!goal) return null;

  const statusStyle = STATUS_STYLES[goal.status];
  const priorityStyle = PRIORITY_STYLES[goal.priority];
  const completedMilestones = goal.milestones.filter((m) => m.status === 'completed');
  const relatedDecisionCount = goal.relatedDecisionIds?.length ?? 0;
  const relatedTaskCount = goal.relatedTaskIds?.length ?? 0;

  const handleClose = () => {
    useCockpitStore.getState().setDiscussingGoalId(null);
  };

  const PHASE_LABELS: Record<DecomposePhase, string> = {
    idle: '',
    decompose: '分解任务',
    assign: '分配人员',
    risk: '风险分析',
    confirm: '确认下发',
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 py-3 bg-white/[0.02] border-b border-white/[0.06]">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${priorityStyle.dot}`} />
          <Icon name="flag" size={15} className="text-green-400 shrink-0" />
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
          >
            <span className="text-xs font-medium text-slate-200 truncate">{goal.title}</span>
            <Icon
              name={collapsed ? 'expand_more' : 'expand_less'}
              size={14}
              className="text-slate-500 shrink-0"
            />
          </button>
          {collapsed && (
            <span className="text-[10px] text-slate-500 shrink-0">{goal.overallProgress}%</span>
          )}
          <span className={`text-[9px] ${statusStyle.color}`}>{statusStyle.label}</span>
          {goal.deadline && (
            <span
              className={`text-[10px] shrink-0 ${goal.isOverdue ? 'text-red-400' : 'text-slate-500'}`}
            >
              {formatDeadline(goal.deadline)}
            </span>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="w-6 h-6 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-colors shrink-0"
          >
            <Icon name="close" size={15} />
          </button>
        </div>

        {/* Collapsible body */}
        {!collapsed && (
          <div className="max-h-[60vh] overflow-y-auto hmr-scrollbar">
            {/* Description + progress bar */}
            <div className="px-4 py-3 space-y-2">
              <p className="text-xs text-slate-300 leading-relaxed">{goal.description}</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-green-400 transition-all duration-500"
                    style={{ width: `${goal.overallProgress}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 font-medium shrink-0">
                  {goal.overallProgress}%
                </span>
              </div>
            </div>

            {/* Milestones summary (only when not in decompose flow) */}
            {phase === 'idle' && goal.milestones.length > 0 && (
              <div className="border-t border-white/[0.06] px-4 py-2.5">
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon name="flag" size={12} className="text-slate-500" />
                  <span className="text-[10px] font-medium text-slate-400">里程碑</span>
                  <span className="text-[9px] text-slate-600">
                    {completedMilestones.length}/{goal.milestones.length}
                  </span>
                </div>
                <div className="space-y-1">
                  {goal.milestones.map((ms) => (
                    <div key={ms.id} className="flex items-center gap-2">
                      <Icon
                        name={
                          ms.status === 'completed'
                            ? 'check_circle'
                            : ms.status === 'active'
                              ? 'radio_button_checked'
                              : 'radio_button_unchecked'
                        }
                        size={12}
                        className={
                          ms.status === 'completed'
                            ? 'text-green-400'
                            : ms.status === 'active'
                              ? 'text-primary'
                              : 'text-slate-500'
                        }
                      />
                      <span
                        className={`text-[10px] flex-1 truncate ${
                          ms.status === 'completed'
                            ? 'text-slate-400 line-through'
                            : ms.status === 'active'
                              ? 'text-slate-200 font-medium'
                              : 'text-slate-500'
                        }`}
                      >
                        {ms.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Related items */}
            {phase === 'idle' && (
              <div className="border-t border-white/[0.06] px-4 py-2.5 flex items-center gap-3">
                {relatedDecisionCount > 0 && (
                  <span className="text-[10px] text-slate-500">
                    <Icon name="bolt" size={10} className="inline mr-0.5 text-orange-400/70" />
                    {relatedDecisionCount} 决策
                  </span>
                )}
                {relatedTaskCount > 0 && (
                  <span className="text-[10px] text-slate-500">
                    <Icon
                      name="pending_actions"
                      size={10}
                      className="inline mr-0.5 text-primary/70"
                    />
                    {relatedTaskCount} 任务
                  </span>
                )}
                {goal.collaboratorIds.length > 0 && (
                  <span className="text-[10px] text-slate-500">
                    <Icon name="group" size={10} className="inline mr-0.5 text-purple-400/70" />
                    {goal.collaboratorIds.length} 协作者
                  </span>
                )}
                <span className="flex-1" />
                {goal.progressUpdates.length > 0 && onOpenDrawer && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenDrawer({
                        type: 'goal-tracker',
                        title: '目标追踪',
                        data: { goalId: goal.id },
                      })
                    }
                    className="text-[10px] text-primary hover:text-primary/80 flex items-center gap-1"
                  >
                    进展时间线
                    <Icon name="chevron_right" size={12} />
                  </button>
                )}
              </div>
            )}

            {/* Contract sections (only in idle phase) */}
            {phase === 'idle' && goal.successCriteria.length > 0 && (
              <div className="border-t border-white/[0.06] px-4 py-2.5">
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon name="target" size={12} className="text-green-400" />
                  <span className="text-[10px] font-medium text-slate-400">成功标准</span>
                </div>
                <div className="space-y-1.5">
                  {goal.successCriteria.map((sc) => (
                    <div key={sc.id} className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-300 flex-1 truncate">
                        {sc.metric}
                      </span>
                      <span className="text-[10px] text-slate-500">目标: {sc.target}</span>
                      {sc.currentValue && (
                        <span
                          className={`text-[10px] font-medium ${sc.currentValue === sc.target ? 'text-green-400' : 'text-orange-400'}`}
                        >
                          当前: {sc.currentValue}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {phase === 'idle' && goal.constraints.length > 0 && (
              <div className="border-t border-white/[0.06] px-4 py-2.5">
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon name="shield" size={12} className="text-orange-400" />
                  <span className="text-[10px] font-medium text-slate-400">约束条件</span>
                </div>
                <div className="space-y-1">
                  {goal.constraints.map((c) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.hardLimit ? 'bg-red-400' : 'bg-yellow-400'}`}
                      />
                      <span className="text-[10px] text-slate-300 flex-1 truncate">
                        {c.description}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Decompose Flow ─── */}

            {/* Phase navigation tabs */}
            {phase !== 'idle' && (
              <div className="border-t border-white/[0.06] px-4 py-2 flex items-center gap-1">
                {(['decompose', 'assign', 'risk', 'confirm'] as DecomposePhase[]).map((p, i) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPhase(p)}
                    className={`text-[10px] px-2 py-1 rounded-md transition-colors flex items-center gap-1 ${
                      p === phase
                        ? 'bg-primary/20 text-primary font-medium'
                        : i < ['decompose', 'assign', 'risk', 'confirm'].indexOf(phase)
                          ? 'text-slate-400 hover:text-slate-200'
                          : 'text-slate-600'
                    }`}
                  >
                    {i + 1}. {PHASE_LABELS[p]}
                  </button>
                ))}
              </div>
            )}

            {/* Phase: Decompose */}
            {phase === 'decompose' && (
              <div className="border-t border-white/[0.06] px-4 py-3">
                <GoalDecomposePanel
                  category={decomposeResult?.category}
                  tasks={editTasks}
                  milestones={editMilestones}
                  onTasksChange={setEditTasks}
                  onMilestonesChange={setEditMilestones}
                />
              </div>
            )}

            {/* Phase: Assign */}
            {phase === 'assign' && (
              <div className="border-t border-white/[0.06] px-4 py-3">
                <TaskAssignmentPanel
                  tasks={editTasks}
                  assignments={editAssignments}
                  onAssignmentsChange={setEditAssignments}
                />
              </div>
            )}

            {/* Phase: Risk */}
            {phase === 'risk' && (
              <div className="border-t border-white/[0.06] px-4 py-3">
                <RiskAnalysisPanel risks={decomposeResult?.riskAnalysis ?? []} />
              </div>
            )}

            {/* Phase: Confirm */}
            {phase === 'confirm' && (
              <div className="border-t border-white/[0.06] px-4 py-3 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="checklist" size={14} className="text-primary" />
                  <span className="text-[11px] font-medium text-slate-300">确认下发</span>
                </div>
                {/* Summary: tasks + assignments */}
                <div className="space-y-1.5">
                  {editTasks.map((task) => {
                    const assignment = editAssignments.find((a) => a.taskId === task.id);
                    return (
                      <div
                        key={task.id}
                        className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2"
                      >
                        <Icon
                          name="subdirectory_arrow_right"
                          size={11}
                          className="text-slate-500 shrink-0"
                        />
                        <span className="text-[11px] text-slate-200 flex-1 truncate">
                          {task.name}
                        </span>
                        <Icon name="arrow_forward" size={10} className="text-slate-600 shrink-0" />
                        {assignment ? (
                          <span className="flex items-center gap-1 text-[10px] text-slate-300">
                            <Icon
                              name={assignment.assigneeType === 'agent' ? 'smart_toy' : 'person'}
                              size={10}
                              className={
                                assignment.assigneeType === 'agent'
                                  ? 'text-primary'
                                  : 'text-slate-400'
                              }
                            />
                            {assignment.assigneeName}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">未分配</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Risk summary */}
                {(decomposeResult?.riskAnalysis ?? []).length > 0 && (
                  <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2">
                    <span className="text-[10px] text-slate-500">
                      已识别 {(decomposeResult?.riskAnalysis ?? []).length} 个风险项
                      {(decomposeResult?.riskAnalysis ?? []).some((r) => r.level === 'high') && (
                        <span className="text-red-400 ml-1">
                          (含{' '}
                          {(decomposeResult?.riskAnalysis ?? []).filter((r) => r.level === 'high').length}{' '}
                          个高风险)
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ─── Bottom Action Bar ─── */}
            <div className="border-t border-white/[0.06] px-4 py-2.5">
              {phase === 'idle' && !decomposeResult?.applied && (
                <button
                  type="button"
                  onClick={() => handleDecompose(false)}
                  disabled={decomposing}
                  className="w-full h-8 rounded-lg bg-primary/15 text-[11px] text-primary font-medium hover:bg-primary/25 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Icon
                    name={decomposing ? 'sync' : 'account_tree'}
                    size={13}
                    className={decomposing ? 'animate-spin' : ''}
                  />
                  {decomposing ? '分析中...' : '智能分解目标'}
                </button>
              )}
              {phase === 'idle' && decomposeResult?.applied && (
                <p className="text-[10px] text-green-400 flex items-center gap-1">
                  <Icon name="check_circle" size={11} />
                  已应用，任务已生成并下发
                </p>
              )}
              {phase === 'decompose' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPhase('idle');
                      setDecomposeResult(null);
                    }}
                    className="h-8 px-3 rounded-lg border border-white/10 text-[10px] text-slate-300 hover:bg-white/[0.06]"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDecompose(false)}
                    disabled={decomposing}
                    className="h-8 px-3 rounded-lg border border-white/10 text-[10px] text-slate-300 hover:bg-white/[0.06] disabled:opacity-50"
                  >
                    重新分析
                  </button>
                  <span className="flex-1" />
                  <button
                    type="button"
                    onClick={() => setPhase('assign')}
                    disabled={editTasks.length === 0}
                    className="h-8 px-4 rounded-lg bg-primary text-[10px] text-white font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
                  >
                    下一步：分配
                    <Icon name="arrow_forward" size={12} />
                  </button>
                </div>
              )}
              {phase === 'assign' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPhase('decompose')}
                    className="h-8 px-3 rounded-lg border border-white/10 text-[10px] text-slate-300 hover:bg-white/[0.06]"
                  >
                    上一步
                  </button>
                  <span className="flex-1" />
                  <button
                    type="button"
                    onClick={() => setPhase('risk')}
                    className="h-8 px-4 rounded-lg bg-primary text-[10px] text-white font-medium hover:bg-primary/90 flex items-center gap-1"
                  >
                    下一步：风险
                    <Icon name="arrow_forward" size={12} />
                  </button>
                </div>
              )}
              {phase === 'risk' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPhase('assign')}
                    className="h-8 px-3 rounded-lg border border-white/10 text-[10px] text-slate-300 hover:bg-white/[0.06]"
                  >
                    上一步
                  </button>
                  <span className="flex-1" />
                  <button
                    type="button"
                    onClick={() => setPhase('confirm')}
                    className="h-8 px-4 rounded-lg bg-primary text-[10px] text-white font-medium hover:bg-primary/90 flex items-center gap-1"
                  >
                    下一步：确认
                    <Icon name="arrow_forward" size={12} />
                  </button>
                </div>
              )}
              {phase === 'confirm' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPhase('risk')}
                    className="h-8 px-3 rounded-lg border border-white/10 text-[10px] text-slate-300 hover:bg-white/[0.06]"
                  >
                    上一步
                  </button>
                  <span className="flex-1" />
                  <button
                    type="button"
                    onClick={handleDispatch}
                    disabled={dispatching || editTasks.length === 0}
                    className="h-8 px-5 rounded-lg bg-green-500 text-[10px] text-white font-medium hover:bg-green-500/90 disabled:opacity-50 flex items-center gap-1"
                  >
                    <Icon
                      name={dispatching ? 'sync' : 'send'}
                      size={12}
                      className={dispatching ? 'animate-spin' : ''}
                    />
                    {dispatching ? '下发中...' : '确认下发'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
