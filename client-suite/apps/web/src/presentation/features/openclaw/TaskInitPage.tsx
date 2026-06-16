/**
 * TaskInitPage — C 栏任务讨论上下文卡片
 *
 * 当 discussingTaskId 非空时渲染在 C 栏对话流顶部，
 * 提供任务进度、子任务摘要、最新日志、操作按钮。
 * 推理过程/完整日志按需在 D 栏 Drawer 展开。
 */
import { useMemo, useState } from 'react';
import { useOpenClawStore } from '../../../application/stores/openclawStore';
import { useUIStore } from '../../../application/stores/uiStore';
import { Icon } from '../../components/ui/Icon';
import { CircularProgress } from './CircularProgress';
import type { OpenClawDrawerContent } from '../../../domain/agent/DrawerContent';

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

interface TaskInitPageProps {
  onOpenDrawer?: (content: OpenClawDrawerContent) => void;
}

export function TaskInitPage({ onOpenDrawer }: TaskInitPageProps) {
  const discussingTaskId = useOpenClawStore((s) => s.discussingTaskId);
  const tasks = useOpenClawStore((s) => s.tasks);
  const pauseTask = useOpenClawStore((s) => s.pauseTask);
  const resumeTask = useOpenClawStore((s) => s.resumeTask);
  const cancelTask = useOpenClawStore((s) => s.cancelTask);
  const setSubView = useUIStore((s) => s.setSubView);

  const [collapsed, setCollapsed] = useState(false);

  const task = useMemo(
    () => tasks.find((t) => t.id === discussingTaskId),
    [tasks, discussingTaskId],
  );

  if (!task) return null;

  const subtasksDone = task.subtasks.filter((s) => s.status === 'success').length;
  const recentLogs = task.logs.slice(-3);

  const handleClose = () => {
    useOpenClawStore.getState().setDiscussingTaskId(null);
  };

  const handleExpandDetail = () => {
    useOpenClawStore.getState().selectTask(task.id);
    setSubView('openclaw:task-detail');
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 py-3 bg-white/[0.02] border-b border-white/[0.06]">
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: task.color }} />
          <Icon name="pending_actions" size={15} className="text-primary shrink-0" />
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
          >
            <span className="text-xs font-medium text-slate-200 truncate">{task.name}</span>
            <Icon name={collapsed ? 'expand_more' : 'expand_less'} size={14} className="text-slate-500 shrink-0" />
          </button>
          {collapsed && (
            <span className="text-[10px] text-slate-500 shrink-0">{task.progress}%</span>
          )}
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
            task.isActive ? 'bg-green-500/15 text-green-400' : 'bg-slate-500/15 text-slate-400'
          }`}>
            {task.isActive ? '运行中' : task.progress >= 100 ? '已完成' : '已暂停'}
          </span>
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
          <div className="max-h-[40vh] overflow-y-auto dcf-scrollbar">
            {/* Progress + subtask summary */}
            <div className="px-4 py-3 flex items-center gap-4">
              <CircularProgress percent={task.progress} size={56} strokeWidth={5} color={task.color} />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Icon name="checklist" size={12} className="text-slate-500" />
                  <span className="text-[10px] text-slate-400">子任务</span>
                  <span className="text-[10px] text-slate-300 font-medium">{subtasksDone}/{task.subtasks.length}</span>
                </div>
                {task.subtasks.slice(0, 4).map((s) => (
                  <div key={s.id} className="flex items-center gap-1.5">
                    <Icon
                      name={s.status === 'success' ? 'check_circle' : s.status === 'running' ? 'radio_button_checked' : s.status === 'failed' ? 'cancel' : 'radio_button_unchecked'}
                      size={11}
                      className={s.status === 'success' ? 'text-green-400' : s.status === 'running' ? 'text-primary' : s.status === 'failed' ? 'text-red-400' : 'text-slate-500'}
                    />
                    <span className={`text-[10px] truncate ${s.status === 'success' ? 'text-slate-400 line-through' : 'text-slate-300'}`}>{s.name}</span>
                  </div>
                ))}
                {task.subtasks.length > 4 && (
                  <span className="text-[9px] text-slate-600">+{task.subtasks.length - 4} 更多</span>
                )}
              </div>
            </div>

            {/* Reasoning chain — click to expand in drawer */}
            {task.reasoningSteps && task.reasoningSteps.length > 0 && (
              <div className="border-t border-white/[0.06] px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => onOpenDrawer?.({ type: 'cot-detail', title: '推理过程', data: { taskId: task.id } })}
                  className="flex items-center gap-1.5 w-full text-left hover:bg-white/[0.03] rounded-md px-1 py-1 -mx-1 transition-colors"
                >
                  <Icon name="psychology" size={12} className="text-primary" />
                  <span className="text-[10px] font-medium text-primary">推理过程</span>
                  <span className="text-[10px] text-slate-600">{task.reasoningSteps.length} 步</span>
                  <span className="flex-1" />
                  <Icon name="chevron_right" size={12} className="text-slate-500" />
                </button>
              </div>
            )}

            {/* Recent logs */}
            {recentLogs.length > 0 && (
              <div className="border-t border-white/[0.06] px-4 py-2.5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Icon name="terminal" size={12} className="text-slate-500" />
                  <span className="text-[10px] font-medium text-slate-400">最新日志</span>
                </div>
                <div className="space-y-0.5">
                  {recentLogs.map((log, i) => (
                    <div key={i} className="flex items-start gap-2 text-[10px]">
                      <span className="text-slate-600 shrink-0 font-mono">{formatTimestamp(log.timestamp)}</span>
                      <span className={`shrink-0 ${
                        log.level === 'ERROR' ? 'text-red-400' :
                        log.level === 'WARN' ? 'text-yellow-400' :
                        'text-slate-500'
                      }`}>[{log.level}]</span>
                      <span className="text-slate-400 truncate">{log.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick actions */}
            <div className="border-t border-white/[0.06] px-4 py-2.5 flex gap-2">
              {task.canPause && (
                <button
                  type="button"
                  onClick={() => pauseTask(task.id)}
                  className="h-7 px-3 rounded-lg border border-white/10 text-[10px] text-slate-300 hover:bg-white/[0.06] transition-colors flex items-center gap-1"
                >
                  <Icon name="pause" size={12} />
                  暂停
                </button>
              )}
              {task.canResume && (
                <button
                  type="button"
                  onClick={() => resumeTask(task.id)}
                  className="h-7 px-3 rounded-lg border border-primary/30 text-[10px] text-primary hover:bg-primary/10 transition-colors flex items-center gap-1"
                >
                  <Icon name="play_arrow" size={12} />
                  恢复
                </button>
              )}
              {task.canCancel && (
                <button
                  type="button"
                  onClick={() => cancelTask(task.id)}
                  className="h-7 px-2 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center"
                  title="停止"
                >
                  <Icon name="stop" size={12} />
                </button>
              )}
              <span className="flex-1" />
              <button
                type="button"
                onClick={handleExpandDetail}
                className="h-7 px-3 rounded-lg border border-primary/20 text-[10px] text-primary hover:bg-primary/[0.06] transition-colors flex items-center gap-1"
              >
                <Icon name="open_in_full" size={12} />
                展开详情
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
