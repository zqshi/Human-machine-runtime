/**
 * TaskDetailPanel — B 栏任务详情面板（320px）
 *
 * 与 EventDetailPanel 结构一致：
 * Header: 任务名 + 颜色 + 关闭
 * 滚动区: CircularProgress + 推理链路 + 子任务 + 日志
 * 底部: 暂停/恢复 + 停止 + 展开详情
 */
import { useState } from 'react';
import { useOpenClawStore } from '../../../application/stores/openclawStore';
import { useUIStore } from '../../../application/stores/uiStore';
import { Icon } from '../../components/ui/Icon';
import { CircularProgress } from './CircularProgress';
import { SubTaskList } from './SubTaskList';
import type { SubTask } from './SubTaskList';

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function TaskReasoningChain({ steps }: { steps: Array<{ label: string; detail: string }> }) {
  const [expanded, setExpanded] = useState(false);

  if (steps.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-slate-300 transition-colors"
      >
        <Icon name={expanded ? 'expand_less' : 'expand_more'} size={13} />
        <span>推理过程</span>
        <span className="text-slate-600">{steps.length} 步</span>
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1.5 pl-3 border-l border-primary/15">
          {steps.map((step, i) => (
            <div key={i}>
              <p className="text-[10px] font-medium text-slate-300">{step.label}</p>
              <p className="text-[10px] text-slate-400 leading-relaxed">{step.detail}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TaskDetailPanel() {
  const bColumnTaskId = useOpenClawStore((s) => s.bColumnTaskId);
  const tasks = useOpenClawStore((s) => s.tasks);
  const selectBColumnTask = useOpenClawStore((s) => s.selectBColumnTask);
  const pauseTask = useOpenClawStore((s) => s.pauseTask);
  const resumeTask = useOpenClawStore((s) => s.resumeTask);
  const cancelTask = useOpenClawStore((s) => s.cancelTask);
  const setSubView = useUIStore((s) => s.setSubView);

  const task = tasks.find((t) => t.id === bColumnTaskId);

  if (!task) return null;

  const close = () => selectBColumnTask(null);

  const handleExpandDetail = () => {
    useOpenClawStore.getState().selectTask(task.id);
    setSubView('openclaw:task-detail');
  };

  const subtasks: SubTask[] = task.subtasks.map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status === 'success' ? 'success' : s.status === 'failed' ? 'failed' : s.status,
  }));

  const recentLogs = task.logs.slice(-5);

  return (
    <div className="w-[320px] shrink-0 border-r border-white/10 flex flex-col bg-glass-sidebar backdrop-blur-[20px] overflow-hidden animate-[slideInLeft_0.2s_ease-out]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10">
        <span
          className="w-2.5 h-2.5 rounded-sm shrink-0"
          style={{ backgroundColor: task.color }}
        />
        <span className="text-xs font-medium text-slate-200 truncate flex-1">{task.name}</span>
        <button
          type="button"
          onClick={close}
          className="w-6 h-6 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors shrink-0"
        >
          <Icon name="close" size={16} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto dcf-scrollbar px-4 py-4 space-y-4">
        {/* Progress ring */}
        <div className="flex justify-center">
          <CircularProgress
            percent={task.progress}
            size={80}
            strokeWidth={6}
            color={task.color}
          />
        </div>

        {/* Reasoning chain */}
        {task.reasoningSteps && task.reasoningSteps.length > 0 && (
          <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon name="psychology" size={12} className="text-primary" />
              <span className="text-[10px] font-medium text-primary">Agent 推理</span>
            </div>
            <TaskReasoningChain steps={task.reasoningSteps} />
          </div>
        )}

        {/* Subtasks */}
        {subtasks.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Icon name="checklist" size={12} className="text-slate-500" />
              <span className="text-[10px] font-medium text-slate-400">子任务</span>
              <span className="text-[9px] text-slate-600">
                ({subtasks.filter(s => s.status === 'success').length}/{subtasks.length})
              </span>
            </div>
            <SubTaskList tasks={subtasks} />
          </div>
        )}

        {/* Recent logs */}
        {recentLogs.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Icon name="terminal" size={12} className="text-slate-500" />
              <span className="text-[10px] font-medium text-slate-400">最近日志</span>
            </div>
            <div className="space-y-1">
              {recentLogs.map((log, i) => (
                <div key={i} className="flex items-start gap-2 text-[10px]">
                  <span className="text-slate-600 shrink-0 font-mono">{formatTimestamp(log.timestamp)}</span>
                  <span className={`shrink-0 ${
                    log.level === 'ERROR' ? 'text-red-400' :
                    log.level === 'WARN' ? 'text-yellow-400' :
                    'text-slate-500'
                  }`}>[{log.level}]</span>
                  <span className="text-slate-400 break-all">{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="border-t border-white/10 px-4 py-2.5 space-y-2 shrink-0">
        <div className="flex gap-1.5">
          {task.canPause && (
            <button
              type="button"
              onClick={() => pauseTask(task.id)}
              className="flex-1 h-7 rounded-lg border border-white/10 text-[10px] text-slate-300 hover:bg-white/5 transition-colors flex items-center justify-center gap-1"
            >
              <Icon name="pause" size={12} />
              暂停
            </button>
          )}
          {task.canResume && (
            <button
              type="button"
              onClick={() => resumeTask(task.id)}
              className="flex-1 h-7 rounded-lg border border-primary/30 text-[10px] text-primary hover:bg-primary/10 transition-colors flex items-center justify-center gap-1"
            >
              <Icon name="play_arrow" size={12} />
              恢复
            </button>
          )}
          {task.canCancel && (
            <button
              type="button"
              onClick={() => cancelTask(task.id)}
              className="flex-1 h-7 rounded-lg border border-red-500/30 text-[10px] text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-1"
            >
              <Icon name="stop" size={12} />
              停止
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={handleExpandDetail}
          className="w-full flex items-center justify-center gap-1.5 h-7 rounded-lg border border-primary/20 text-[10px] text-primary hover:bg-primary/[0.06] transition-colors"
        >
          <Icon name="open_in_full" size={12} />
          展开详情
        </button>
      </div>
    </div>
  );
}
