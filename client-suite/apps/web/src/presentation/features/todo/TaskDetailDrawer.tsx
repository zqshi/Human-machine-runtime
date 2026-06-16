import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { AppleCheckbox } from '../../components/ui/AppleCheckbox';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { Avatar } from '../../components/ui/Avatar';
import type { Todo, TodoPriority } from '../../../domain/todo/Todo';
import { appEvents } from '../../../application/events/eventBus';
import { useTodoStore } from '../../../application/stores/todoStore';
import { useToastStore } from '../../../application/stores/toastStore';

const PRIORITY_COLORS: Record<TodoPriority, string> = {
  high: '#FF3B30',
  medium: '#FF9500',
  low: '#34C759',
};

const PRIORITY_LABELS: Record<TodoPriority, string> = {
  high: '高优先级待办',
  medium: '中优先级待办',
  low: '低优先级',
};

interface TaskDetailDrawerProps {
  todo: Todo;
  onClose: () => void;
}

export function TaskDetailDrawer({ todo, onClose }: TaskDetailDrawerProps) {
  const { selectedListId, toggleTodo, toggleSubtask } = useTodoStore();
  const [progressNote, setProgressNote] = useState('');
  return (
    <div className="w-80 border-l border-border bg-bg-secondary overflow-y-auto animate-slide-in-right flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-text-primary">任务详情</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md hover:bg-bg-hover transition-colors text-text-secondary"
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      <div className="flex-1 p-4 space-y-5 overflow-y-auto">
        {/* Priority badge + title */}
        <div>
          <span
            className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md mb-2"
            style={{
              color: PRIORITY_COLORS[todo.priority],
              backgroundColor: `${PRIORITY_COLORS[todo.priority]}14`,
            }}
          >
            {PRIORITY_LABELS[todo.priority]}
          </span>
          <h2 className="text-base font-semibold text-text-primary leading-tight">{todo.title}</h2>
        </div>

        {/* Properties */}
        <div className="space-y-3">
          {todo.dueDate && (
            <PropertyRow icon="calendar_today" label="截止日期">
              <span className={`text-xs font-medium ${todo.isOverdue ? 'text-error' : 'text-text-primary'}`}>
                {todo.dueDate}
              </span>
            </PropertyRow>
          )}
          {todo.channelId && (
            <PropertyRow icon="chat_bubble" label="关联频道">
              <button
                type="button"
                onClick={() => appEvents.emit('navigate:chat', { roomId: todo.channelId! })}
                className="text-xs text-primary font-medium cursor-pointer hover:underline flex items-center gap-1"
              >
                {todo.channelName ?? '频道'}
                <Icon name="chevron_right" size={14} className="text-text-muted" />
              </button>
            </PropertyRow>
          )}
          {todo.documentId && (
            <PropertyRow icon="description" label="关联文档">
              <button
                type="button"
                onClick={() => appEvents.emit('navigate:knowledge', { subView: 'knowledge:doc-read', documentId: todo.documentId! })}
                className="text-xs text-primary font-medium cursor-pointer hover:underline flex items-center gap-1"
              >
                {todo.documentName ?? '文档'}
                <Icon name="open_in_new" size={14} className="text-text-muted" />
              </button>
            </PropertyRow>
          )}
        </div>

        {/* Subtasks */}
        {todo.subtasks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <SectionLabel>子任务</SectionLabel>
              <span className="text-[11px] text-text-muted">
                {todo.completedSubtaskCount}/{todo.subtasks.length} 已完成
              </span>
            </div>
            <div className="space-y-1 px-1">
              {todo.subtasks.map((sub) => (
                <div key={sub.id} className="flex items-center gap-2 py-1">
                  <AppleCheckbox checked={sub.completed} onChange={() => selectedListId && toggleSubtask(selectedListId, todo.id, sub.id)} />
                  <span
                    className={`text-xs ${
                      sub.completed ? 'line-through text-text-muted' : 'text-text-primary'
                    }`}
                  >
                    {sub.title}
                  </span>
                </div>
              ))}
              <button type="button" onClick={() => useToastStore.getState().addToast('添加子任务功能开发中', 'info')} className="flex items-center gap-1 text-xs text-primary font-medium mt-1 hover:text-primary/80">
                <Icon name="add" size={14} />
                <span>添加子任务</span>
              </button>
            </div>
          </div>
        )}

        {/* Collaborators */}
        <div className="space-y-2">
          <SectionLabel>协作成员</SectionLabel>
          <div className="flex items-center gap-1 px-2">
            <Avatar letter="张" size={28} />
            <Avatar letter="李" size={28} />
            <button
              type="button"
              onClick={() => useToastStore.getState().addToast('添加协作成员功能开发中', 'info')}
              className="w-7 h-7 rounded-full border border-dashed border-border-primary flex items-center justify-center text-text-muted hover:border-primary hover:text-primary transition-colors"
            >
              <Icon name="add" size={14} />
            </button>
          </div>
        </div>

        {/* AI Tips */}
        <div className="rounded-xl bg-gradient-to-br from-primary/8 to-[#5856D6]/8 border border-primary/15 p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Icon name="auto_awesome" size={14} className="text-primary" />
            <span className="text-xs font-semibold text-primary">待办小贴士</span>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            根据日历安排，建议下午 2:00-3:00 进行代码审核，这段时间没有其他会议冲突。
          </p>
        </div>

        {/* Progress sync editor */}
        <div className="space-y-2">
          <SectionLabel>进展同步</SectionLabel>
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-fill-tertiary/30">
              <button type="button" onClick={() => useToastStore.getState().addToast('加粗', 'info')} className="p-1 text-text-muted hover:text-text-secondary rounded">
                <Icon name="format_bold" size={16} />
              </button>
              <button type="button" onClick={() => useToastStore.getState().addToast('斜体', 'info')} className="p-1 text-text-muted hover:text-text-secondary rounded">
                <Icon name="format_italic" size={16} />
              </button>
              <button type="button" onClick={() => useToastStore.getState().addToast('插入链接功能开发中', 'info')} className="p-1 text-text-muted hover:text-text-secondary rounded">
                <Icon name="link" size={16} />
              </button>
              <button type="button" onClick={() => useToastStore.getState().addToast('提及他人功能开发中', 'info')} className="p-1 text-text-muted hover:text-text-secondary rounded">
                <Icon name="alternate_email" size={16} />
              </button>
            </div>
            <textarea
              placeholder="在此更新任务进度..."
              value={progressNote}
              onChange={(e) => setProgressNote(e.target.value)}
              className="w-full px-3 py-2 text-xs text-text-primary bg-transparent resize-none focus:outline-none min-h-[60px]"
            />
            <div className="flex items-center justify-between px-2 py-1.5 border-t border-border">
              <button type="button" onClick={() => useToastStore.getState().addToast('添加附件功能开发中', 'info')} className="inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-text-secondary">
                <Icon name="attach_file" size={14} />
                添加附件
              </button>
              <button
                type="button"
                onClick={() => { useToastStore.getState().addToast('进展已发布', 'success'); setProgressNote(''); }}
                className="px-3 py-1 bg-primary text-white text-[11px] font-medium rounded-md hover:bg-primary/90 transition-colors"
              >
                发布
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom action */}
      <div className="p-4 border-t border-border">
        <button
          type="button"
          onClick={() => {
            if (selectedListId) toggleTodo(selectedListId, todo.id);
            onClose();
          }}
          className="w-full py-2.5 bg-primary text-white text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors"
        >
          标记为已完成
        </button>
      </div>
    </div>
  );
}

function PropertyRow({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-2">
      <Icon name={icon} size={14} className="text-text-muted shrink-0" />
      <span className="text-xs text-text-muted w-16 shrink-0">{label}</span>
      <div className="flex items-center gap-1 flex-1 min-w-0 justify-end">{children}</div>
    </div>
  );
}
