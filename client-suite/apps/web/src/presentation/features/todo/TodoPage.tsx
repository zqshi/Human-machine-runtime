import { useState, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { SearchInput } from '../../components/ui/SearchInput';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { useTodoStore } from '../../../application/stores/todoStore';
import { useToastStore } from '../../../application/stores/toastStore';
import { TaskCard } from './TaskCard';
import { TaskDetailDrawer } from './TaskDetailDrawer';
import { TaskDetailFullModal } from './TaskDetailFullModal';
import { SMART_VIEWS, CUSTOM_LISTS } from '../../../domain/todo/TodoConfig';
import type { Todo } from '../../../domain/todo/Todo';

export function TodoSidebar() {
  const { lists, selectedListId, selectList } = useTodoStore();
  const [search, setSearch] = useState('');

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary">个人待办</h3>
        <button
          type="button"
          onClick={() => selectList('today')}
          className="p-1 rounded-md text-primary hover:bg-primary/5 transition-colors"
        >
          <Icon name="add" size={20} />
        </button>
      </div>

      <SearchInput value={search} onChange={setSearch} placeholder="搜索待办事项..." />

      {/* Smart views */}
      <div className="space-y-0.5">
        {SMART_VIEWS.filter(({ label }) => !search || label.includes(search)).map(
          ({ id, label, icon }) => {
            const list = lists.find((l) => l.id === id);
            const count = list ? list.pendingCount : 0;
            const isActive = selectedListId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => selectList(id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'hover:bg-bg-hover text-text-primary font-medium'
                }`}
              >
                <Icon
                  name={icon}
                  size={16}
                  className={isActive ? 'text-primary' : 'text-text-secondary'}
                />
                <span className="flex-1 text-left">{label}</span>
                {count > 0 && (
                  <span className="text-[10px] text-text-muted bg-fill-tertiary rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                    {count}
                  </span>
                )}
              </button>
            );
          }
        )}
      </div>

      {/* Custom lists */}
      <div className="space-y-0.5">
        <SectionLabel>清单</SectionLabel>
        {CUSTOM_LISTS.filter(({ label }) => !search || label.includes(search)).map(
          ({ id, label, color }) => {
            const list = lists.find((l) => l.id === id);
            const count = list ? list.pendingCount : 0;
            const isActive = selectedListId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => selectList(id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'hover:bg-bg-hover text-text-primary font-medium'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="flex-1 text-left">{label}</span>
                {count > 0 && <span className="text-[10px] text-text-muted">{count}</span>}
              </button>
            );
          }
        )}
      </div>
    </div>
  );
}

function AddTaskBar({ listId }: { listId: string }) {
  const [value, setValue] = useState('');
  const addTodo = useTodoStore((s) => s.addTodo);

  const handleSubmit = () => {
    const title = value.trim();
    if (!title) return;
    addTodo(listId, {
      id: `todo-${Date.now()}`,
      title,
      completed: false,
      priority: 'medium',
    });
    setValue('');
  };

  return (
    <div className="flex items-center gap-3 p-3 border border-border rounded-xl bg-bg-white-var">
      <Icon name="add" size={20} className="text-primary" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing || e.keyCode === 229) return;
          if (e.key === 'Enter') handleSubmit();
        }}
        placeholder="添加待办事项..."
        className="flex-1 text-sm text-text-primary placeholder:text-text-muted bg-transparent focus:outline-none"
      />
      <button
        type="button"
        className="p-1 text-text-muted hover:text-text-secondary"
        title="设置日期"
        onClick={() => useToastStore.getState().addToast('日期选择即将上线', 'info')}
      >
        <Icon name="calendar_month" size={18} />
      </button>
      <button
        type="button"
        className="p-1 text-text-muted hover:text-text-secondary"
        title="设置优先级"
        onClick={() => useToastStore.getState().addToast('优先级选择即将上线', 'info')}
      >
        <Icon name="flag" size={18} />
      </button>
    </div>
  );
}

export function TodoPage() {
  const { lists, selectedListId, selectedTodoId, toggleTodo, selectTodo } = useTodoStore();
  const [modalTodo, setModalTodo] = useState<Todo | null>(null);

  // Fetch backend tasks on mount
  useEffect(() => {
    useTodoStore.getState().fetchFromBackend();
  }, []);

  const selectedList = lists.find((l) => l.id === selectedListId);
  const selectedTodo = selectedList?.items.find((t) => t.id === selectedTodoId) ?? null;

  const handleTaskClick = (todo: Todo) => {
    if (todo.subtasks.length > 0) {
      setModalTodo(todo);
    } else {
      selectTodo(todo.id);
    }
  };

  if (!selectedList) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
        选择一个列表开始
      </div>
    );
  }

  const highPriority = selectedList.items.filter((t) => !t.completed && t.priority === 'high');
  const mediumPriority = selectedList.items.filter((t) => !t.completed && t.priority === 'medium');
  const lowPriority = selectedList.items.filter((t) => !t.completed && t.priority === 'low');
  const completed = selectedList.items.filter((t) => t.completed);

  const today = new Date();
  const dateStr = `${today.getMonth() + 1}月${today.getDate()}日，${['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][today.getDay()]}`;

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-text-primary">{selectedList.name}</h2>
              <span className="text-sm text-text-muted">{dateStr}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="p-1.5 rounded-md text-text-muted hover:bg-bg-hover"
                title="筛选"
                onClick={() => useToastStore.getState().addToast('筛选功能即将上线', 'info')}
              >
                <Icon name="filter_list" size={18} />
              </button>
              <button
                type="button"
                className="p-1.5 rounded-md text-text-muted hover:bg-bg-hover"
                title="更多"
                onClick={() => useToastStore.getState().addToast('更多操作即将上线', 'info')}
              >
                <Icon name="more_horiz" size={18} />
              </button>
            </div>
          </div>

          {/* Add task bar */}
          <AddTaskBar listId={selectedList.id} />

          {/* High priority group */}
          {highPriority.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 px-1">
                <span className="w-2 h-2 rounded-full bg-error" />
                <span className="text-xs font-medium text-text-secondary">高优先级</span>
              </div>
              {highPriority.map((todo) => (
                <TaskCard
                  key={todo.id}
                  todo={todo}
                  onToggle={() => toggleTodo(selectedList.id, todo.id)}
                  onClick={() => handleTaskClick(todo)}
                  active={todo.id === selectedTodoId}
                />
              ))}
            </div>
          )}

          {/* Medium priority group */}
          {mediumPriority.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 px-1">
                <span className="w-2 h-2 rounded-full bg-warning" />
                <span className="text-xs font-medium text-text-secondary">中优先级</span>
              </div>
              {mediumPriority.map((todo) => (
                <TaskCard
                  key={todo.id}
                  todo={todo}
                  onToggle={() => toggleTodo(selectedList.id, todo.id)}
                  onClick={() => handleTaskClick(todo)}
                  active={todo.id === selectedTodoId}
                />
              ))}
            </div>
          )}

          {/* Low / daily tasks */}
          {lowPriority.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 px-1">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-xs font-medium text-text-secondary">日常事务</span>
              </div>
              {lowPriority.map((todo) => (
                <TaskCard
                  key={todo.id}
                  todo={todo}
                  onToggle={() => toggleTodo(selectedList.id, todo.id)}
                  onClick={() => handleTaskClick(todo)}
                  active={todo.id === selectedTodoId}
                />
              ))}
            </div>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider px-1 pt-2">
                已完成 ({completed.length})
              </p>
              {completed.map((todo) => (
                <TaskCard
                  key={todo.id}
                  todo={todo}
                  onToggle={() => toggleTodo(selectedList.id, todo.id)}
                  onClick={() => handleTaskClick(todo)}
                  active={todo.id === selectedTodoId}
                />
              ))}
            </div>
          )}

          {selectedList.items.length === 0 && (
            <div className="text-center py-12 text-text-muted text-sm">
              <Icon name="task_alt" size={40} className="opacity-30 mb-2" />
              <p>暂无任务</p>
            </div>
          )}
        </div>
      </div>

      {selectedTodo && <TaskDetailDrawer todo={selectedTodo} onClose={() => selectTodo(null)} />}

      {modalTodo && (
        <TaskDetailFullModal
          onClose={() => setModalTodo(null)}
          onComplete={() => {
            if (selectedList) toggleTodo(selectedList.id, modalTodo.id);
            setModalTodo(null);
          }}
        />
      )}
    </div>
  );
}
