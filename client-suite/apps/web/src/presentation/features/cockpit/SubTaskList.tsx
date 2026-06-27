/**
 * SubTaskList — 子任务列表组件（可复用）
 */
import { Icon } from '../../components/ui/Icon';

interface SubTask {
  id: string;
  name: string;
  status: 'success' | 'running' | 'pending' | 'failed';
}

const STATUS_MAP: Record<SubTask['status'], { icon: string; cls: string; label: string }> = {
  success: { icon: 'check_circle', cls: 'text-green-400', label: '已完成' },
  running: { icon: 'autorenew', cls: 'text-primary animate-spin', label: '进行中' },
  pending: { icon: 'hourglass_empty', cls: 'text-slate-500', label: '等待中' },
  failed: { icon: 'error', cls: 'text-red-400', label: '失败' },
};

interface SubTaskListProps {
  tasks: SubTask[];
}

export function SubTaskList({ tasks }: SubTaskListProps) {
  return (
    <div className="space-y-1.5">
      {tasks.map((t) => {
        const s = STATUS_MAP[t.status];
        return (
          <div
            key={t.id}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.02]"
          >
            <Icon name={s.icon} size={16} className={s.cls} />
            <span className="flex-1 text-xs text-slate-200 truncate">{t.name}</span>
            <span className="text-[10px] text-slate-500">{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export type { SubTask };
