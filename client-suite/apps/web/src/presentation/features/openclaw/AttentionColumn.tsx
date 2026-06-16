/**
 * AttentionColumn — 决策态势面板（左栏）
 *
 * 统一数据源：attentionItems（openclawStore）。
 * 四分组优先级递减：
 *   战略目标 → 待决策 → 进行中（任务）→ 外部消息（待处理/已处理）
 */
import { useState, useMemo, useCallback, useRef } from 'react';
import {
  useNotificationStore,
  selectNeedsHumanCount,
} from '../../../application/stores/notificationStore';
import { useOpenClawStore } from '../../../application/stores/openclawStore';
import type { AttentionItem } from '../../../domain/agent/DrawerContent';
import { Icon } from '../../components/ui/Icon';
import { TaskAttentionCard } from './TaskAttentionCard';
import { GoalAttentionCard } from './GoalAttentionCard';
import { DecisionAttentionCard } from './DecisionAttentionCard';
import { ConversationHistoryList } from './ConversationHistoryList';
import { GoalCreationDialog } from './GoalCreationDialog';

const CHANNEL_COLORS: Record<string, string> = {
  lark: '#34C759',
  email: '#007AFF',
  slack: '#FF3B30',
  matrix: '#AF52DE',
  wechat: '#07C160',
  teams: '#6264A7',
};

const CHANNEL_LABELS: Record<string, string> = {
  lark: '飞书',
  email: '邮件',
  slack: 'Slack',
  matrix: 'Matrix',
  wechat: '微信',
  teams: 'Teams',
};

/** Drag-to-resize hook: tracks mouse on right edge of a column */
function useColumnResize(options: { initialWidth: number; minWidth: number; maxWidth: number }) {
  const [width, setWidth] = useState(options.initialWidth);
  const isDragging = useRef(false);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      const startX = e.clientX;
      const startWidth = width;

      const onMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const delta = ev.clientX - startX;
        const next = Math.min(options.maxWidth, Math.max(options.minWidth, startWidth + delta));
        setWidth(next);
      };

      const onMouseUp = () => {
        isDragging.current = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [width, options.minWidth, options.maxWidth]
  );

  return { width, resizeHandleProps: { onMouseDown } };
}

/** Cross-channel inbox event card — driven by AttentionItem */
function InboxEventCard({
  item,
  isSelected,
  onClick,
}: {
  item: AttentionItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  const channelColor = CHANNEL_COLORS[item.channel ?? ''] ?? '#64748b';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors relative ${
        isSelected
          ? 'border-primary/40 bg-primary/[0.08]'
          : item.resolved
            ? 'border-white/[0.06] bg-white/[0.01] opacity-60 hover:opacity-80'
            : item.isNeedsHuman
              ? 'border-orange-500/30 bg-orange-500/[0.04] hover:bg-orange-500/[0.08]'
              : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
      }`}
    >
      {/* Source row */}
      <div className="flex items-center gap-2 mb-1">
        {!item.resolved && item.isNeedsHuman && (
          <span
            className="w-2 h-2 rounded-full shrink-0 bg-orange-500 animate-pulse"
            title="需要人工介入"
          />
        )}
        {!item.resolved && !item.isNeedsHuman && (
          <span className="w-2 h-2 rounded-full shrink-0 bg-red-500 animate-pulse" />
        )}
        <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: channelColor }} />
        <span className="text-xs font-medium text-slate-200 truncate flex-1">{item.title}</span>
      </div>

      {/* Message summary */}
      {item.summary && (
        <p className="text-[11px] text-slate-400 line-clamp-1 pl-4">{item.summary}</p>
      )}
    </button>
  );
}

interface AttentionColumnProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function AttentionColumn({ collapsed, onToggleCollapse }: AttentionColumnProps) {
  const needsHumanCount = useNotificationStore(selectNeedsHumanCount);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const discussingNotificationId = useOpenClawStore((s) => s.discussingNotificationId);

  const attentionItems = useOpenClawStore((s) => s.attentionItems);
  const discussingTaskId = useOpenClawStore((s) => s.discussingTaskId);
  const discussingGoalId = useOpenClawStore((s) => s.discussingGoalId);
  const discussingDecisionId = useOpenClawStore((s) => s.discussingDecisionId);
  const setDiscussingTaskId = useOpenClawStore((s) => s.setDiscussingTaskId);
  const setDiscussingGoalId = useOpenClawStore((s) => s.setDiscussingGoalId);
  const decisionRequests = useOpenClawStore((s) => s.decisionRequests);
  const goals = useOpenClawStore((s) => s.goals);
  const aColumnTab = useOpenClawStore((s) => s.aColumnTab);
  const setAColumnTab = useOpenClawStore((s) => s.setAColumnTab);
  const workOrders = useOpenClawStore((s) => s.workOrders);
  const discussingWorkOrderId = useOpenClawStore((s) => s.discussingWorkOrderId);
  const setDiscussingWorkOrderId = useOpenClawStore((s) => s.setDiscussingWorkOrderId);

  const [showGoalCreation, setShowGoalCreation] = useState(false);

  // Split attentionItems by kind
  const goalItems = useMemo(
    () => attentionItems.filter((i) => i.kind === 'goal'),
    [attentionItems]
  );
  const decisionItems = useMemo(
    () => attentionItems.filter((i) => i.kind === 'decision'),
    [attentionItems]
  );
  const taskItems = useMemo(
    () => attentionItems.filter((i) => i.kind === 'task' && !i.resolved),
    [attentionItems]
  );
  const completedTaskItems = useMemo(
    () => attentionItems.filter((i) => i.kind === 'task' && i.resolved),
    [attentionItems]
  );
  const workOrderItems = useMemo(
    () => attentionItems.filter((i) => i.kind === 'workorder'),
    [attentionItems]
  );
  // Notification items: only from cross-channel sources
  const notificationItems = useMemo(
    () =>
      attentionItems.filter(
        (i) => i.kind === 'notification' && i.channel && i.channel !== 'system'
      ),
    [attentionItems]
  );
  const pendingNotifications = useMemo(() => {
    const pending = notificationItems.filter((i) => !i.resolved);
    return pending.sort((a, b) => {
      const aHuman = a.isNeedsHuman ? 1 : 0;
      const bHuman = b.isNeedsHuman ? 1 : 0;
      if (aHuman !== bHuman) return bHuman - aHuman;
      return (b.timestamp ?? 0) - (a.timestamp ?? 0);
    });
  }, [notificationItems]);
  const resolvedNotifications = useMemo(
    () => notificationItems.filter((i) => i.resolved),
    [notificationItems]
  );

  const [handledExpanded, setHandledExpanded] = useState(false);
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [_resolvedDecisionExpanded, _setResolvedDecisionExpanded] = useState(false);

  // Badge count = pending decisions + active tasks + workOrders + needsHuman
  const totalBadge =
    decisionItems.length + taskItems.length + workOrderItems.length + needsHumanCount;
  const criticalDecisionCount = useMemo(
    () => decisionRequests.filter((d) => d.isPending && d.urgency === 'critical').length,
    [decisionRequests]
  );

  const { width, resizeHandleProps } = useColumnResize({
    initialWidth: 240,
    minWidth: 160,
    maxWidth: 420,
  });

  const handleNotificationClick = useCallback((item: AttentionItem) => {
    if (item.notificationId) {
      // 两栏策略：详情直接内嵌 C 栏 DiscussionInitPage，不弹 B/D 栏
      useOpenClawStore.getState().setDiscussingNotificationId(item.notificationId);
    }
  }, []);

  const handleDecisionClick = useCallback((item: AttentionItem) => {
    if (item.decisionId) {
      // 两栏策略：决策上下文内嵌 C 栏，和 Agent 澄清讨论
      useOpenClawStore.getState().setDiscussingDecisionId(item.decisionId);
    }
  }, []);

  const handleGoalClick = useCallback(
    (item: AttentionItem) => {
      if (item.goalId) {
        setDiscussingGoalId(item.goalId);
      }
    },
    [setDiscussingGoalId]
  );

  const handleWorkOrderClick = useCallback(
    (item: AttentionItem) => {
      if (item.workOrderId) {
        setDiscussingWorkOrderId(item.workOrderId);
      }
    },
    [setDiscussingWorkOrderId]
  );

  // Resolved decision items (non-pending + expired)
  const _resolvedDecisionItems = useMemo(
    () => decisionRequests.filter((d) => !d.isPending || d.isExpired),
    [decisionRequests]
  );

  if (collapsed) {
    return (
      <div className="w-[40px] shrink-0 border-r border-white/10 flex flex-col items-center py-3 bg-glass-sidebar backdrop-blur-[20px]">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition-colors"
          title="展开决策"
        >
          <Icon name="chevron_right" size={16} />
        </button>
        {totalBadge > 0 && (
          <span className="min-w-[18px] h-[18px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center mt-2">
            {totalBadge}
          </span>
        )}
      </div>
    );
  }

  const hasContent =
    goalItems.length > 0 ||
    decisionItems.length > 0 ||
    taskItems.length > 0 ||
    completedTaskItems.length > 0 ||
    workOrderItems.length > 0 ||
    pendingNotifications.length > 0 ||
    resolvedNotifications.length > 0;

  return (
    <div
      className="shrink-0 border-r border-white/10 flex flex-col bg-glass-sidebar backdrop-blur-[20px] overflow-hidden relative"
      style={{ width }}
    >
      {/* Header with Tabs */}
      <div className="border-b border-white/10 shrink-0">
        <div className="flex items-center justify-between px-3 pt-3 pb-0">
          <div className="flex items-center gap-0">
            <button
              type="button"
              onClick={() => setAColumnTab('attention')}
              className={`flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium border-b-2 transition-colors ${
                aColumnTab === 'attention'
                  ? 'text-slate-100 border-primary'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
            >
              <Icon name="radar" size={13} />
              决策
              {totalBadge > 0 && (
                <span className="min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {totalBadge}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setAColumnTab('history')}
              className={`flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium border-b-2 transition-colors ${
                aColumnTab === 'history'
                  ? 'text-slate-100 border-primary'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
            >
              <Icon name="history" size={13} />
              对话
            </button>
          </div>
          <div className="flex items-center gap-1 pb-1.5">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/[0.06] transition-colors"
              title="收起"
            >
              <Icon name="chevron_left" size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Tab content */}
      {aColumnTab === 'history' ? (
        <div className="flex-1 overflow-y-auto dcf-scrollbar">
          <ConversationHistoryList />
        </div>
      ) : (
        /* Grouped list */
        <div className="flex-1 overflow-y-auto dcf-scrollbar">
          {!hasContent ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <Icon name="notifications_none" size={36} className="text-slate-600 mb-2" />
              <p className="text-[11px]">暂无待办事项</p>
              <button
                type="button"
                onClick={() => setShowGoalCreation(true)}
                className="mt-3 h-7 px-3 rounded-lg bg-primary/20 text-[10px] text-primary font-medium hover:bg-primary/30 flex items-center gap-1"
              >
                <Icon name="add" size={12} />
                创建目标
              </button>
            </div>
          ) : (
            <div className="p-2 space-y-3">
              {/* Mark all as read */}
              {needsHumanCount > 0 && (
                <div className="flex justify-end px-1">
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    全部已读
                  </button>
                </div>
              )}
              {/* Strategic goals section */}
              {goalItems.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 px-1 py-1">
                    <Icon name="flag" size={12} className="text-primary/70" />
                    <span className="text-[10px] font-medium text-slate-400">战略目标</span>
                    <span className="text-[9px] text-slate-500">({goalItems.length})</span>
                    <span className="flex-1" />
                    <button
                      type="button"
                      onClick={() => setShowGoalCreation(true)}
                      className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-primary hover:bg-primary/10 transition-colors"
                      title="创建目标"
                    >
                      <Icon name="add" size={12} />
                    </button>
                  </div>
                  <div className="space-y-1 mt-1">
                    {goalItems.map((item) => {
                      const goal = goals.find((g) => g.id === item.goalId);
                      return (
                        <GoalAttentionCard
                          key={item.id}
                          title={item.title}
                          progress={item.goalProgress ?? 0}
                          priority={
                            item.goalPriority as 'critical' | 'high' | 'normal' | 'low' | undefined
                          }
                          milestones={goal?.milestones.map((m) => ({
                            name: m.name,
                            status: m.status,
                          }))}
                          isSelected={discussingGoalId === item.goalId}
                          onClick={() => handleGoalClick(item)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Pending decisions section */}
              {decisionItems.length > 0 && (
                <div data-guide="attention-decisions">
                  <div className="flex items-center gap-1.5 px-1 py-1">
                    <Icon name="bolt" size={12} className="text-orange-400/70" />
                    <span className="text-[10px] font-medium text-slate-400">待决策</span>
                    <span className="text-[9px] text-slate-500">({decisionItems.length})</span>
                    {criticalDecisionCount > 0 && (
                      <span className="min-w-[14px] h-[14px] px-0.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">
                        {criticalDecisionCount}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 mt-1">
                    {decisionItems.map((item) => {
                      const decision = decisionRequests.find((d) => d.id === item.decisionId);
                      return (
                        <DecisionAttentionCard
                          key={item.id}
                          title={item.title}
                          urgency={decision?.urgency}
                          deadline={item.deadline}
                          summary={item.summary}
                          isSelected={discussingDecisionId === item.decisionId}
                          onClick={() => handleDecisionClick(item)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Active tasks section */}
              {taskItems.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 px-1 py-1">
                    <Icon name="pending_actions" size={12} className="text-primary/70" />
                    <span className="text-[10px] font-medium text-slate-400">进行中</span>
                    <span className="text-[9px] text-slate-500">({taskItems.length})</span>
                  </div>
                  <div className="space-y-1 mt-1">
                    {taskItems.map((item) => (
                      <TaskAttentionCard
                        key={item.id}
                        item={item}
                        isSelected={discussingTaskId === item.taskId}
                        onClick={() => setDiscussingTaskId(item.taskId!)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Completed tasks section — collapsible archive */}
              {completedTaskItems.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setCompletedExpanded(!completedExpanded)}
                    className="flex items-center gap-1.5 px-1 py-1 w-full text-left"
                  >
                    <Icon
                      name={completedExpanded ? 'expand_more' : 'chevron_right'}
                      size={12}
                      className="text-slate-500"
                    />
                    <Icon name="task_alt" size={12} className="text-slate-600" />
                    <span className="text-[10px] font-medium text-slate-500">已完成</span>
                    <span className="text-[9px] text-slate-600">({completedTaskItems.length})</span>
                  </button>
                  {completedExpanded && (
                    <div className="space-y-1 mt-1">
                      {completedTaskItems.map((item) => (
                        <TaskAttentionCard
                          key={item.id}
                          item={item}
                          isSelected={false}
                          onClick={() => setDiscussingTaskId(item.taskId!)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Work orders section */}
              {workOrderItems.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 px-1 py-1">
                    <Icon name="assignment" size={12} className="text-purple-400/70" />
                    <span className="text-[10px] font-medium text-slate-400">协作工单</span>
                    <span className="text-[9px] text-slate-500">({workOrderItems.length})</span>
                  </div>
                  <div className="space-y-1 mt-1">
                    {workOrderItems.map((item) => {
                      const wo = workOrders.find((w) => w.id === item.workOrderId);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleWorkOrderClick(item)}
                          className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                            discussingWorkOrderId === item.workOrderId
                              ? 'border-purple-400/40 bg-purple-400/[0.08]'
                              : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="w-2 h-2 rounded-full shrink-0 bg-purple-400 animate-pulse" />
                            <span className="text-xs font-medium text-slate-200 truncate flex-1">
                              {item.title}
                            </span>
                            {wo && wo.confidence >= 0.9 && (
                              <span className="text-[8px] px-1 py-0.5 rounded bg-green-400/10 text-green-300">
                                AI 预答
                              </span>
                            )}
                          </div>
                          {item.summary && (
                            <p className="text-[11px] text-slate-400 line-clamp-1 pl-4">
                              {item.summary}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Pending notifications — grouped by channel */}
              {pendingNotifications.length > 0 && (
                <div data-guide="attention-notifications">
                  <div className="flex items-center gap-1.5 px-1 py-1">
                    <Icon name="inbox" size={12} className="text-red-400/60" />
                    <span className="text-[10px] font-medium text-slate-400">待处理</span>
                    <span className="text-[9px] text-slate-500">
                      ({pendingNotifications.length})
                    </span>
                  </div>
                  <NotificationChannelGroup
                    items={pendingNotifications}
                    activeNotificationId={discussingNotificationId}
                    onItemClick={handleNotificationClick}
                  />
                </div>
              )}

              {/* Resolved notifications — collapsible */}
              {resolvedNotifications.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setHandledExpanded(!handledExpanded)}
                    className="flex items-center gap-1.5 px-1 py-1 w-full text-left"
                  >
                    <Icon
                      name={handledExpanded ? 'expand_more' : 'chevron_right'}
                      size={12}
                      className="text-slate-500"
                    />
                    <span className="text-[10px] font-medium text-slate-500">已处理</span>
                    <span className="text-[9px] text-slate-600">
                      ({resolvedNotifications.length})
                    </span>
                  </button>
                  {handledExpanded && (
                    <NotificationChannelGroup
                      items={resolvedNotifications}
                      activeNotificationId={discussingNotificationId}
                      onItemClick={handleNotificationClick}
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Resize handle */}
      <div
        {...resizeHandleProps}
        className="absolute top-0 right-0 w-[5px] h-full cursor-col-resize z-10 hover:bg-primary/20 active:bg-primary/30 transition-colors"
        title="拖拽调整宽度"
      />
      <GoalCreationDialog open={showGoalCreation} onClose={() => setShowGoalCreation(false)} />
    </div>
  );
}

/** Group notification AttentionItems by channel, render with channel headers */
function NotificationChannelGroup({
  items,
  activeNotificationId,
  onItemClick,
}: {
  items: AttentionItem[];
  activeNotificationId: string | null;
  onItemClick: (item: AttentionItem) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, AttentionItem[]>();
    for (const item of items) {
      const key = item.channel ?? 'other';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    <div className="space-y-2 mt-1">
      {groups.map(([channel, channelItems]) => (
        <div key={channel}>
          {groups.length > 1 && (
            <div className="flex items-center gap-1.5 px-1 py-0.5">
              <span
                className="w-1.5 h-1.5 rounded-sm shrink-0"
                style={{ backgroundColor: CHANNEL_COLORS[channel] ?? '#64748b' }}
              />
              <span className="text-[9px] font-medium text-slate-500">
                {CHANNEL_LABELS[channel] ?? channel}
              </span>
            </div>
          )}
          <div className="space-y-1">
            {channelItems.map((item) => (
              <InboxEventCard
                key={item.id}
                item={item}
                isSelected={activeNotificationId === item.notificationId}
                onClick={() => onItemClick(item)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
