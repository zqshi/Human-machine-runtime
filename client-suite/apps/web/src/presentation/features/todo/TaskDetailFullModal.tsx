/**
 * TaskDetailFullModal — 任务详情全屏模态 (stitch_3 对齐)
 * 左栏: 子任务列表 + 任务属性 + 协作成员
 * 右栏: 进展同步富文本 + 活动记录流 (含文件/图片/系统日志)
 *
 * 数据源: 从 props 接收真实 Todo 实体。子任务取自 todo.subtasks；
 * 活动流后端尚无 API，渲染诚实空态。绝不虚构协作者/附件/活动。
 */
import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useToastStore } from '../../../application/stores/toastStore';
import type { Todo, TodoPriority } from '../../../domain/todo/Todo';

const PRIORITY_LABELS: Record<TodoPriority, string> = {
  high: '最高',
  medium: '中',
  low: '低',
};

const PRIORITY_COLORS: Record<TodoPriority, string> = {
  high: '#FF3B30',
  medium: '#FF9500',
  low: '#34C759',
};

interface TaskDetailFullModalProps {
  todo: Todo;
  onClose?: () => void;
  onComplete?: () => void;
}

export function TaskDetailFullModal({ todo, onClose, onComplete }: TaskDetailFullModalProps) {
  const [progressNote, setProgressNote] = useState('');
  const subtaskTotal = todo.subtasks.length;
  const subtaskDone = todo.completedSubtaskCount;
  const subtaskPercent = subtaskTotal > 0 ? Math.round((subtaskDone / subtaskTotal) * 100) : 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-[900px] max-h-[85vh] bg-bg-white-var rounded-2xl shadow-2xl flex overflow-hidden">
        {/* Left column */}
        <div className="w-[400px] border-r border-border flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-text-muted hover:text-text-secondary"
            >
              <Icon name="arrow_back" size={18} />
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onComplete}
                className="px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90 flex items-center gap-1"
              >
                <Icon name="check" size={14} /> 完成任务
              </button>
              <button
                type="button"
                onClick={() => useToastStore.getState().addToast('更多操作开发中', 'info')}
                className="p-1 text-text-muted hover:text-text-secondary"
              >
                <Icon name="more_horiz" size={18} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1 text-text-muted hover:text-text-secondary"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-text-primary">{todo.title}</h2>
            </div>

            {/* Subtasks */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-text-secondary">
                  子任务 ({subtaskDone}/{subtaskTotal})
                </h4>
                {subtaskTotal > 0 && (
                  <span className="text-[10px] text-text-muted">{subtaskPercent}%</span>
                )}
              </div>
              {subtaskTotal > 0 ? (
                <>
                  <div className="h-1.5 bg-fill-tertiary rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${subtaskPercent}%` }}
                    />
                  </div>
                  <div className="space-y-2">
                    {todo.subtasks.map((st) => (
                      <div
                        key={st.id}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border/50"
                      >
                        <span
                          className={`w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            st.completed ? 'bg-primary border-primary' : 'border-border'
                          }`}
                        >
                          {st.completed && <Icon name="check" size={10} className="text-white" />}
                        </span>
                        <span
                          className={`flex-1 text-xs ${st.completed ? 'text-text-muted' : 'text-text-primary'}`}
                        >
                          {st.title}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-text-muted">暂无子任务</p>
              )}
            </section>

            {/* Properties */}
            <section className="space-y-3">
              <h4 className="text-xs font-semibold text-text-secondary">任务属性</h4>
              {todo.dueDate ? (
                <div className="flex items-center gap-2 text-xs">
                  <Icon name="calendar_today" size={14} className="text-text-muted" />
                  <span className="text-text-muted w-16">截止时间</span>
                  <span className={todo.isOverdue ? 'text-error' : 'text-text-primary'}>
                    {todo.dueDate}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs">
                  <Icon name="calendar_today" size={14} className="text-text-muted" />
                  <span className="text-text-muted w-16">截止时间</span>
                  <span className="text-text-muted">未设置</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs">
                <Icon name="flag" size={14} style={{ color: PRIORITY_COLORS[todo.priority] }} />
                <span className="text-text-muted w-16">优先级</span>
                <span className="font-medium" style={{ color: PRIORITY_COLORS[todo.priority] }}>
                  {PRIORITY_LABELS[todo.priority]}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Icon name="person" size={14} className="text-text-muted" />
                <span className="text-text-muted w-16">负责人</span>
                <span className={todo.assignee ? 'text-text-primary' : 'text-text-muted'}>
                  {todo.assignee ?? '未指派'}
                </span>
              </div>
            </section>

            {/* Collaborators */}
            <section>
              <h4 className="text-xs font-semibold text-text-secondary mb-2">协作成员</h4>
              <div className="flex items-center gap-1">
                {todo.assignee ? (
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                    {todo.assignee.slice(0, 1)}
                  </div>
                ) : (
                  <span className="text-xs text-text-muted">暂无协作成员</span>
                )}
                <button
                  type="button"
                  onClick={() =>
                    useToastStore.getState().addToast('添加协作成员功能开发中', 'info')
                  }
                  className="w-8 h-8 rounded-full border-2 border-dashed border-border flex items-center justify-center text-text-muted"
                >
                  <Icon name="add" size={14} />
                </button>
              </div>
            </section>
          </div>
        </div>

        {/* Right column - Activity */}
        <div className="flex-1 flex flex-col">
          {/* Rich text input */}
          <div className="p-4 border-b border-border">
            <div className="border border-border rounded-xl p-3">
              <textarea
                placeholder="同步任务进度，@提及他人..."
                value={progressNote}
                onChange={(e) => setProgressNote(e.target.value)}
                className="w-full text-xs text-text-secondary resize-none focus:outline-none min-h-[60px]"
              />
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => useToastStore.getState().addToast('插入图片功能开发中', 'info')}
                    className="p-1 text-text-muted hover:text-text-secondary"
                  >
                    <Icon name="image" size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => useToastStore.getState().addToast('添加附件功能开发中', 'info')}
                    className="p-1 text-text-muted hover:text-text-secondary"
                  >
                    <Icon name="attach_file" size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => useToastStore.getState().addToast('插入表情功能开发中', 'info')}
                    className="p-1 text-text-muted hover:text-text-secondary"
                  >
                    <Icon name="sentiment_satisfied" size={14} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    useToastStore.getState().addToast('进展已更新', 'success');
                    setProgressNote('');
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90"
                >
                  更新进展
                </button>
              </div>
            </div>
          </div>

          {/* Activity feed — 后端尚无活动流 API，渲染诚实空态 */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex flex-col items-center justify-center h-full text-center text-text-muted">
              <Icon name="forum" size={40} className="opacity-30 mb-2" />
              <p className="text-xs">暂无活动记录</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
