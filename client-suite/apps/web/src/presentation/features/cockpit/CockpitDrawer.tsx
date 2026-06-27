/**
 * CockpitDrawer -- 统一右侧面板，按 drawerContent.type 路由渲染不同内容。
 *
 * Drawer 默认关闭，仅在用户主动点击对话卡片或关注事项时展开。
 * 每次只展示一个焦点内容，切换时直接替换。
 */
import { useState, useRef, useCallback } from 'react';
import { useCockpitStore } from '../../../application/stores/cockpitStore';
import { useUIStore } from '../../../application/stores/uiStore';
import { useToastStore } from '../../../application/stores/toastStore';
import { useNotificationStore } from '../../../application/stores/notificationStore';
import { appEvents } from '../../../application/events/eventBus';
import type { CockpitDrawerContent } from '../../../domain/agent/DrawerContent';
import { Icon } from '../../components/ui/Icon';
import { SubTaskList } from './SubTaskList';
import { ExecutionLogViewer } from './ExecutionLogViewer';
import { CircularProgress } from './CircularProgress';
import { CollaborationChainGraph } from './CollaborationChainGraph';
import { DecisionTreeCard } from './DecisionTreeCard';
import { DecisionDetailContent } from './DecisionDetailContent';
import { GoalTrackerContent } from './GoalTrackerContent';
import { AppPreviewContent } from './AppPreviewContent';
import { DocEditorContent } from './DocEditorContent';
import { ProjectBoardContent } from './ProjectBoardContent';
import AgentStudioContent from './drawer-panels/AgentStudioContent';

/* ─── helpers ─── */

const STATUS_LABELS: Record<string, string> = {
  queued: '排队中',
  running: '进行中',
  paused: '已暂停',
  completed: '已完成',
  failed: '失败',
};

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

const CHANNEL_COLORS: Record<string, string> = {
  lark: '#34C759',
  email: '#007AFF',
  slack: '#FF3B30',
};

const COT_STEP_ICON: Record<string, { icon: string; cls: string }> = {
  done: { icon: 'check_circle', cls: 'text-green-400' },
  running: { icon: 'autorenew', cls: 'text-primary animate-spin' },
  pending: { icon: 'hourglass_empty', cls: 'text-slate-500' },
  error: { icon: 'error', cls: 'text-red-400' },
};

/* ─── Content renderers ─── */

interface ContentProps {
  data: Record<string, unknown>;
}

function CoTDetailContent({ data }: ContentProps) {
  const messageId = data.messageId as string;
  const conversations = useCockpitStore((s) => s.conversations);
  const allMessages = Object.values(conversations).flat();
  const message = allMessages.find((m) => m.id === messageId);

  if (!message?.cotSteps) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
        <Icon name="psychology" size={40} className="text-slate-600 mb-2" />
        <p className="text-xs">推理步骤未找到</p>
      </div>
    );
  }

  const completedCount = message.cotSteps.filter((s) => s.status === 'done').length;

  return (
    <div className="flex-1 overflow-y-auto hmr-scrollbar px-4 py-3 space-y-4">
      {/* CoT header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon name="psychology" size={16} className="text-primary" />
          <span className="text-xs font-medium text-primary">思维链路详情</span>
        </div>
        <span className="text-[10px] text-slate-500">
          {completedCount}/{message.cotSteps.length} 完成
        </span>
      </div>

      {/* Steps timeline */}
      <div className="relative space-y-0">
        {message.cotSteps.map((step, idx) => {
          const isLast = idx === message.cotSteps!.length - 1;
          const si = COT_STEP_ICON[step.status] ?? COT_STEP_ICON.pending;

          return (
            <div key={step.id} className="relative">
              {/* Connector line */}
              {!isLast && (
                <div className="absolute left-[7px] top-[18px] w-px h-[calc(100%+4px)] bg-white/10" />
              )}
              {/* Step card */}
              <div className="flex items-start gap-3 pb-4">
                <Icon
                  name={si.icon}
                  size={16}
                  className={`${si.cls} relative z-10 shrink-0 mt-0.5`}
                />
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-medium text-slate-200">{step.label}</span>

                  {/* ── Tool calls — always visible ── */}
                  {step.toolCalls && step.toolCalls.length > 0 && (
                    <div className="mt-1.5 space-y-1">
                      {step.toolCalls.map((tc) => (
                        <div
                          key={tc.id}
                          className="flex items-start gap-1.5 text-[10px] leading-relaxed"
                        >
                          <Icon
                            name={tc.icon}
                            size={11}
                            className="text-amber-400 shrink-0 mt-[2px]"
                          />
                          <span className="text-amber-300/80 shrink-0">{tc.name}</span>
                          {tc.result ? (
                            <>
                              <span className="text-slate-600 shrink-0">-&gt;</span>
                              <span className="text-emerald-300/80">{tc.result}</span>
                            </>
                          ) : tc.status === 'running' ? (
                            <span className="text-slate-500 italic">执行中...</span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Knowledge refs — always visible ── */}
                  {step.knowledgeRefs && step.knowledgeRefs.length > 0 && (
                    <div className="mt-1.5 space-y-1.5">
                      {step.knowledgeRefs.map((kr) => (
                        <div key={kr.id}>
                          <div className="flex items-start gap-1.5 text-[10px] leading-relaxed">
                            <Icon
                              name={kr.icon}
                              size={11}
                              className="text-blue-400 shrink-0 mt-[2px]"
                            />
                            <span className="text-blue-300/80 shrink-0">{kr.name}</span>
                            {kr.result && (
                              <>
                                <span className="text-slate-600 shrink-0">-&gt;</span>
                                <span className="text-blue-200/70">{kr.result}</span>
                              </>
                            )}
                          </div>
                          {/* Citation chips */}
                          {kr.citations && kr.citations.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1 pl-[17px]">
                              {kr.citations.map((c, ci) => (
                                <span
                                  key={ci}
                                  title={c.snippet ?? c.title}
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-500/[0.08] border border-blue-500/15 text-[9px] text-blue-300/70 cursor-default"
                                >
                                  <Icon name="description" size={9} className="text-blue-400/50" />
                                  {c.title}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Step conclusion ── */}
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">{step.detail}</p>
                  <span className="text-[10px] text-slate-600 mt-0.5 block">
                    {step.status === 'done'
                      ? '已完成'
                      : step.status === 'running'
                        ? '执行中...'
                        : step.status === 'error'
                          ? '失败'
                          : '等待中'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskDetailContent({ data }: ContentProps) {
  const tasks = useCockpitStore((s) => s.tasks);
  const pauseTask = useCockpitStore((s) => s.pauseTask);
  const resumeTask = useCockpitStore((s) => s.resumeTask);
  const cancelTask = useCockpitStore((s) => s.cancelTask);
  const [confirmAction, setConfirmAction] = useState<'cancel' | null>(null);
  const task = tasks.find((t) => t.id === data.taskId);

  if (!task) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
        <Icon name="task_alt" size={40} className="text-slate-600 mb-2" />
        <p className="text-xs">任务未找到</p>
      </div>
    );
  }

  const subtasks = task.subtasks.map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status,
  }));

  const logs = task.logs.map((l) => ({
    time: formatTimestamp(l.timestamp),
    level: l.level,
    message: l.message,
  }));

  return (
    <>
      <div className="flex-1 overflow-y-auto hmr-scrollbar px-4 py-3 space-y-4">
        <section className="flex justify-center py-2">
          <CircularProgress
            percent={task.progress}
            label={STATUS_LABELS[task.status] ?? '进行中'}
          />
        </section>

        <section>
          <h4 className="text-xs font-medium text-slate-300 mb-2">子任务执行情况</h4>
          <SubTaskList tasks={subtasks} />
        </section>

        <section>
          <h4 className="text-xs font-medium text-slate-300 mb-2">执行日志</h4>
          <ExecutionLogViewer logs={logs} maxHeight={250} />
        </section>
      </div>

      {/* Footer — real intervention buttons */}
      <div className="border-t border-white/10 px-4 py-3 space-y-2">
        {confirmAction === 'cancel' ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-300 flex-1">确定停止任务？</span>
            <button
              type="button"
              onClick={() => {
                cancelTask(task.id);
                setConfirmAction(null);
              }}
              className="h-7 px-3 rounded-lg bg-red-500/20 text-xs text-red-400 hover:bg-red-500/30 transition-colors"
            >
              确定
            </button>
            <button
              type="button"
              onClick={() => setConfirmAction(null)}
              className="h-7 px-3 rounded-lg border border-white/10 text-xs text-slate-400 hover:bg-white/5 transition-colors"
            >
              取消
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            {task.canPause && (
              <button
                type="button"
                onClick={() => pauseTask(task.id)}
                className="flex-1 h-8 rounded-lg border border-white/10 text-xs text-slate-300 hover:bg-white/5 transition-colors flex items-center justify-center gap-1"
              >
                <Icon name="pause" size={14} />
                暂停
              </button>
            )}
            {task.canResume && (
              <button
                type="button"
                onClick={() => resumeTask(task.id)}
                className="flex-1 h-8 rounded-lg border border-primary/30 text-xs text-primary hover:bg-primary/10 transition-colors flex items-center justify-center gap-1"
              >
                <Icon name="play_arrow" size={14} />
                继续
              </button>
            )}
            {task.canCancel && (
              <button
                type="button"
                onClick={() => setConfirmAction('cancel')}
                className="flex-1 h-8 rounded-lg border border-red-500/20 text-xs text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-1"
              >
                <Icon name="stop" size={14} />
                停止
              </button>
            )}
            <button
              type="button"
              onClick={() => useToastStore.getState().addToast('报告生成中...', 'info')}
              className="flex-1 h-8 rounded-lg border border-white/10 text-xs text-slate-300 hover:bg-white/5 transition-colors flex items-center justify-center gap-1"
            >
              <Icon name="summarize" size={14} />
              报告
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function SourceDetailContent({ data }: ContentProps) {
  return (
    <div className="flex-1 overflow-y-auto hmr-scrollbar px-4 py-3 space-y-4">
      <section>
        <h4 className="text-xs font-medium text-slate-300 mb-2">
          {(data.title as string) ?? '来源详情'}
        </h4>
        <p className="text-xs text-slate-400">来源详情加载中...</p>
      </section>
      <section>
        <h4 className="text-xs font-medium text-slate-300 mb-2">完整文档</h4>
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
          <p className="text-xs text-slate-500 italic">将在此处展示知识库文档内容</p>
        </div>
      </section>
    </div>
  );
}

function DataExplorerContent({ data }: ContentProps) {
  const columns = (data.columns ?? []) as string[];
  const rows = (data.rows ?? []) as string[][];

  return (
    <div className="flex-1 overflow-y-auto hmr-scrollbar px-4 py-3">
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-white/10">
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-2 py-1.5 text-left font-medium text-slate-300 bg-white/[0.03]"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="odd:bg-white/[0.02] border-b border-white/5 last:border-b-0">
                {row.map((cell, j) => (
                  <td key={j} className="px-2 py-1.5 text-slate-400">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CodeViewerContent({ data }: ContentProps) {
  const language = (data.language as string) ?? 'text';
  const code = (data.code as string) ?? '';
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      useToastStore.getState().addToast('复制失败', 'error');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto hmr-scrollbar px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.06] text-slate-400">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200 transition-colors"
        >
          <Icon name={copied ? 'check' : 'content_copy'} size={12} />
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <pre className="font-mono text-[11px] bg-black/30 rounded-lg p-3 text-slate-300 whitespace-pre-wrap break-all overflow-x-auto">
        {code}
      </pre>
    </div>
  );
}

function ExecutionLogContent({ data }: ContentProps) {
  const logs = (
    (data.logs ?? []) as Array<{
      timestamp: number;
      level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
      message: string;
    }>
  ).map((l) => ({ time: formatTimestamp(l.timestamp), level: l.level, message: l.message }));
  return (
    <div className="flex-1 overflow-y-auto hmr-scrollbar px-4 py-3">
      <ExecutionLogViewer logs={logs} maxHeight={500} />
    </div>
  );
}

function CollaborationChainContent({ data }: ContentProps) {
  const chains = useCockpitStore((s) => s.collaborationChains);
  const chain = chains.find((c) => c.id === data.chainId);

  if (!chain) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
        <Icon name="account_tree" size={40} className="text-slate-600 mb-2" />
        <p className="text-xs">协作链未找到</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto hmr-scrollbar px-4 py-3 space-y-4">
      <p className="text-xs text-slate-400">{chain.description}</p>
      <CollaborationChainGraph chain={chain} />
    </div>
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  autonomous: '自主执行',
  monitoring: '监控发现',
  insight: '智能洞察',
};

function ActivityDetailContent({ data }: ContentProps) {
  const activityId = data.activityId as string;
  const proactiveActivities = useCockpitStore((s) => s.proactiveActivities);
  const decisionTrees = useCockpitStore((s) => s.decisionTrees);
  const executeFollowUp = useCockpitStore((s) => s.executeFollowUp);
  const activity = proactiveActivities.find((a) => a.id === activityId);
  const tree = decisionTrees[activityId];

  if (!activity) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
        <Icon name="history" size={40} className="text-slate-600 mb-2" />
        <p className="text-xs">行为记录未找到</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto hmr-scrollbar px-4 py-3 space-y-4">
      {/* Activity header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center shrink-0">
          <Icon name={activity.icon} size={22} style={{ color: activity.iconColor }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-100">{activity.action}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/[0.06] text-slate-400">
              {CATEGORY_LABEL[activity.category] ?? activity.category}
            </span>
            <span className="text-[10px] text-slate-500">{activity.time}</span>
          </div>
        </div>
      </div>

      {/* Detail */}
      <div className="rounded-lg bg-white/[0.03] border border-white/10 p-3">
        <p className="text-xs text-slate-300 leading-relaxed">{activity.detail}</p>
      </div>

      {/* Decision tree */}
      {tree && (
        <DecisionTreeCard
          tree={tree}
          onFollowUp={(actionId) => executeFollowUp(activityId, actionId)}
        />
      )}
    </div>
  );
}

function NotificationDetailContent({ data }: ContentProps) {
  const notifications = useNotificationStore((s) => s.notifications);
  const setComposerPrefill = useCockpitStore((s) => s.setComposerPrefill);
  const closeDrawer = useCockpitStore((s) => s.closeDrawer);
  const notificationId = data.notificationId as string;
  const notification = notifications.find((n) => n.id === notificationId);
  const [reply, setReply] = useState('');

  if (!notification) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
        <Icon name="notifications_none" size={40} className="text-slate-600 mb-2" />
        <p className="text-xs">通知未找到</p>
      </div>
    );
  }

  const handleSend = () => {
    if (!reply.trim()) return;
    if (notification.channel) {
      appEvents.emit('im:cross-channel-reply', {
        channel: notification.channel,
        sender: notification.sender.name,
        message: reply.trim(),
      });
    }
    setReply('');
    useToastStore.getState().addToast('回复已发送', 'success');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto hmr-scrollbar px-4 py-3 space-y-4">
        {/* Notification header */}
        <div className="rounded-lg bg-white/[0.03] border border-white/10 p-3">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: CHANNEL_COLORS[notification.channel ?? ''] ?? '#64748b' }}
            />
            <span className="text-sm font-medium text-slate-200">{notification.title}</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">{notification.body}</p>
        </div>

        {/* Context messages */}
        {notification.contextMessages && notification.contextMessages.length > 0 && (
          <section>
            <h4 className="text-xs font-medium text-slate-300 mb-2">完整对话历史</h4>
            <div className="space-y-2">
              {notification.contextMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 ${msg.isOwn ? 'bg-primary/10 text-slate-200' : 'bg-white/[0.04] text-slate-300'}`}
                  >
                    <p className="text-xs font-medium mb-0.5">{msg.senderName}</p>
                    <p className="text-xs leading-relaxed">{msg.body}</p>
                    <p className="text-[9px] text-slate-500 mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Actions */}
      <div className="border-t border-white/10 px-4 py-3 space-y-2">
        {/* Delegate to Agent */}
        <button
          onClick={() => {
            setComposerPrefill(
              `关于「${notification.title}」的通知：${notification.body}\n请帮我处理并回复`
            );
            closeDrawer();
          }}
          className="w-full h-8 rounded-lg border border-primary/30 text-xs text-primary hover:bg-primary/10 transition-colors flex items-center justify-center gap-1.5"
        >
          <Icon name="smart_toy" size={14} />
          指示 Agent 处理
        </button>

        {/* Reply input */}
        {notification.channel && (
          <div className="space-y-1.5">
            <textarea
              placeholder="输入回复..."
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-primary/40 resize-none"
            />
            <button
              onClick={handleSend}
              disabled={!reply.trim()}
              className="w-full h-7 rounded-lg bg-primary text-xs text-white font-medium hover:bg-primary-dark disabled:opacity-40 transition-colors flex items-center justify-center gap-1"
            >
              <Icon name="send" size={14} />
              回复
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Content router ─── */

const CONTENT_RENDERERS: Record<
  CockpitDrawerContent['type'],
  React.ComponentType<ContentProps>
> = {
  'task-detail': TaskDetailContent,
  'activity-detail': ActivityDetailContent,
  'source-detail': SourceDetailContent,
  'data-explorer': DataExplorerContent,
  'code-viewer': CodeViewerContent,
  'execution-log': ExecutionLogContent,
  'collaboration-chain': CollaborationChainContent,
  'notification-detail': NotificationDetailContent,
  'decision-detail': DecisionDetailContent,
  'goal-tracker': GoalTrackerContent,
  'cot-detail': CoTDetailContent,
  'inbox-thread': NotificationDetailContent,
  'app-preview': AppPreviewContent,
  'doc-editor': DocEditorContent,
  'project-board': ProjectBoardContent,
  'agent-studio': AgentStudioContent,
};

/* ─── Main component ─── */

export function CockpitDrawer() {
  const drawerContent = useCockpitStore((s) => s.drawerContent);
  const drawerWidth = useCockpitStore((s) => s.drawerWidth);
  const setDrawerWidth = useCockpitStore((s) => s.setDrawerWidth);
  const closeDrawer = useCockpitStore((s) => s.closeDrawer);
  const setSubView = useUIStore((s) => s.setSubView);

  // ── Drag resize ──
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      startX.current = e.clientX;
      startWidth.current = drawerWidth;

      const handleMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const delta = startX.current - ev.clientX; // dragging left = wider
        setDrawerWidth(startWidth.current + delta);
      };

      const handleMouseUp = () => {
        isDragging.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [drawerWidth, setDrawerWidth]
  );

  if (!drawerContent) return null;

  const ContentRenderer = CONTENT_RENDERERS[drawerContent.type];

  const handleFullScreen = () => {
    if (drawerContent.type === 'task-detail') {
      setSubView('cockpit:task-detail');
    }
  };

  return (
    <div
      className="shrink-0 border-l border-white/10 flex flex-col bg-glass-sidebar backdrop-blur-[20px] overflow-hidden animate-[slideInRight_0.25s_ease-out] relative"
      style={{ width: drawerWidth }}
    >
      {/* Drag resize handle */}
      <div
        onMouseDown={handleDragStart}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-20 hover:bg-primary/40 active:bg-primary/60 transition-colors"
      />
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/10">
        <button
          onClick={closeDrawer}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors mr-1"
        >
          <Icon name="arrow_back" size={18} />
        </button>
        <h3 className="flex-1 min-w-0 text-sm font-semibold text-slate-100 truncate">
          {drawerContent.title}
        </h3>
        <div className="flex items-center gap-1 ml-2">
          {drawerContent.type === 'task-detail' && (
            <button
              onClick={handleFullScreen}
              title="全屏查看"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
            >
              <Icon name="open_in_full" size={18} />
            </button>
          )}
        </div>
      </div>

      {ContentRenderer ? (
        <ContentRenderer data={drawerContent.data} />
      ) : (
        <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
          不支持的内容类型: {drawerContent.type}
        </div>
      )}
    </div>
  );
}
