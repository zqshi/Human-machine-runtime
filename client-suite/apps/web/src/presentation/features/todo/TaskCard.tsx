import { Icon } from '../../components/ui/Icon';
import { AppleCheckbox } from '../../components/ui/AppleCheckbox';
import type { Todo, TodoPriority } from '../../../domain/todo/Todo';

const PRIORITY_COLORS: Record<TodoPriority, string> = {
  high: '#FF3B30',
  medium: '#FF9500',
  low: '#34C759',
};

const PRIORITY_LABELS: Record<TodoPriority, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

interface TaskCardProps {
  todo: Todo;
  onToggle: () => void;
  onClick: () => void;
  active?: boolean;
}

export function TaskCard({ todo, onToggle, onClick, active = false }: TaskCardProps) {
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className={`flex items-start gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all border ${
        active
          ? 'bg-primary/5 border-primary/20 shadow-sm'
          : 'bg-bg-white-var border-border hover:border-border-primary hover:shadow-md hover:-translate-y-px'
      }`}
    >
      <div className="pt-0.5" onClick={handleToggle}>
        <AppleCheckbox checked={todo.completed} onChange={onToggle} />
      </div>

      <div className="flex-1 min-w-0">
        <p
          className={`text-sm leading-tight ${
            todo.completed
              ? 'line-through text-text-muted'
              : 'text-text-primary font-medium'
          }`}
        >
          {todo.title}
        </p>

        {/* Metadata row */}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {todo.dueDate && (
            <span className={`inline-flex items-center gap-1 text-[11px] ${todo.isOverdue ? 'text-error' : 'text-text-muted'}`}>
              <Icon name="schedule" size={12} />
              {todo.dueDate}
            </span>
          )}
          {todo.assignee && (
            <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
              <Icon name="person" size={12} />
              {todo.assignee}
            </span>
          )}
          {todo.description && (
            <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
              <Icon name="description" size={12} />
              {todo.description.slice(0, 20)}
            </span>
          )}
        </div>
      </div>

      {/* Priority badge or completion time */}
      {todo.completed ? (
        <span className="shrink-0 text-[10px] text-text-muted mt-0.5">
          <Icon name="check_circle" size={14} className="text-success inline mr-0.5" />
          完成
        </span>
      ) : (
        <span
          className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md mt-0.5"
          style={{
            color: PRIORITY_COLORS[todo.priority],
            backgroundColor: `${PRIORITY_COLORS[todo.priority]}14`,
          }}
        >
          {PRIORITY_LABELS[todo.priority]}
        </span>
      )}
    </div>
  );
}
