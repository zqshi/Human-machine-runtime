/**
 * TaskDetailView — 任务全屏详情 (cockpit_2)
 * Left: Agent CoT 对话区   Right: 进度环 + 子任务 + 日志
 */
import { useState } from 'react';
import { useUIStore } from '../../../application/stores/uiStore';
import { useToastStore } from '../../../application/stores/toastStore';
import { useCockpitStore } from '../../../application/stores/cockpitStore';
import { CoTMessage } from '../../../domain/agent/CoTMessage';
import { Icon } from '../../components/ui/Icon';

const EMPTY_MESSAGES: CoTMessage[] = [];
import { CircularProgress } from './CircularProgress';
import { SubTaskList } from './SubTaskList';
import { ExecutionLogViewer } from './ExecutionLogViewer';
import type { SubTask } from './SubTaskList';
import type { LogEntry } from './ExecutionLogViewer';

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

export function TaskDetailView() {
  const setSubView = useUIStore((s) => s.setSubView);
  const [input, setInput] = useState('');
  const toast = (msg: string) => useToastStore.getState().addToast(msg, 'info');

  const selectedTaskId = useCockpitStore((s) => s.selectedTaskId);
  const tasks = useCockpitStore((s) => s.tasks);
  const activeConversationId = useCockpitStore((s) => s.activeConversationId);
  const conversations = useCockpitStore((s) => s.conversations);
  const conversation = conversations[activeConversationId] ?? EMPTY_MESSAGES;

  const task = tasks.find((t) => t.id === selectedTaskId);

  if (!task) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Icon name="task_alt" size={48} className="text-slate-600 mb-3" />
          <p className="text-sm text-slate-400">请选择一个任务查看详情</p>
        </div>
      </div>
    );
  }

  const cotMessages = conversation;

  const subtasks: SubTask[] = task.subtasks.map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status,
  }));

  const logs: LogEntry[] = task.logs.map((l) => ({
    time: formatTimestamp(l.timestamp),
    level: l.level,
    message: l.message,
  }));

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    // Placeholder: append user message to unified conversation
    useCockpitStore.getState().appendMessage(
      CoTMessage.create({
        id: `u-${Date.now()}`,
        agentId: 'primary',
        sessionId: useCockpitStore.getState().sessionId ?? '',
        role: 'user',
        text,
        timestamp: Date.now(),
      })
    );
    setInput('');
  };

  return (
    <div className="flex h-full">
      {/* Left: CoT conversation */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-white/10">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <button
            type="button"
            onClick={() => setSubView(null)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
          >
            <Icon name="arrow_back" size={18} />
          </button>
          <span className="text-xs font-medium text-slate-300">思维链分析：{task.name}</span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => toast('日志导出中...')}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Icon name="download" size={14} />
            导出日志
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto hmr-scrollbar px-6 py-4 space-y-3">
          {cotMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-line ${
                  msg.role === 'user'
                    ? 'bg-bg-active text-slate-100 chat-bubble-sent'
                    : 'bg-white/5 text-slate-200 chat-bubble-received'
                }`}
              >
                {msg.text}
                {msg.timestamp > 0 && (
                  <span className="block text-[10px] text-slate-500 mt-1">
                    {formatTimestamp(msg.timestamp)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="border-t border-white/10 px-6 py-3">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <input
              type="text"
              placeholder="输入指令或提问..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                if (e.key === 'Enter') handleSend();
              }}
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 outline-none"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim()}
              className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white hover:bg-primary-dark transition-colors disabled:opacity-40"
            >
              <Icon name="send" size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Right: Task detail */}
      <div className="w-[400px] shrink-0 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <button
            onClick={() => setSubView(null)}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Icon name="arrow_back" size={18} />
          </button>
          <span className="text-sm font-medium text-slate-100">
            {task.name} #{task.id}
          </span>
        </div>

        {/* Scrollable */}
        <div className="flex-1 overflow-y-auto hmr-scrollbar px-4 py-4 space-y-5">
          {/* Circular progress */}
          <div className="flex justify-center py-2">
            <CircularProgress
              percent={task.progress}
              label={task.status === 'completed' ? '已完成' : '扫描中'}
            />
          </div>

          {/* Sub-tasks */}
          <section>
            <h4 className="text-xs font-medium text-slate-300 mb-2">子任务状态</h4>
            <SubTaskList tasks={subtasks} />
          </section>

          {/* Logs */}
          <section>
            <h4 className="text-xs font-medium text-slate-300 mb-2">执行日志</h4>
            <ExecutionLogViewer logs={logs} maxHeight={250} />
          </section>
        </div>

        {/* Bottom actions */}
        <div className="border-t border-white/10 px-4 py-3 flex gap-2">
          <button
            type="button"
            onClick={() => toast('任务已停止')}
            className="flex-1 h-9 rounded-lg border border-red-500/30 text-xs text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-1"
          >
            <Icon name="stop" size={14} />
            停止任务
          </button>
          <button
            type="button"
            onClick={() => toast('正在生成报告...')}
            className="flex-1 h-9 rounded-lg bg-primary text-xs text-white font-medium hover:bg-primary-dark transition-colors flex items-center justify-center gap-1"
          >
            <Icon name="summarize" size={14} />
            生成完整报告
          </button>
        </div>
      </div>
    </div>
  );
}
