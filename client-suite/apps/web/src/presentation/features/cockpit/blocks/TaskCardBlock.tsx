import { useCockpitStore } from '../../../../application/stores/cockpitStore';
import { Icon } from '../../../components/ui/Icon';
import { blockTokens } from './blockTokens';
import type { CockpitDrawerContent } from '../../../../domain/agent/DrawerContent';
import type { AgentTaskStatus } from '../../../../domain/shared/types';

interface Props {
  taskId: string;
  styleHints?: Record<string, string>;
  onOpen: (content: CockpitDrawerContent) => void;
}

const statusConfig: Record<
  AgentTaskStatus,
  { icon: string; color: string; label: string; spin?: boolean }
> = {
  running: { icon: 'autorenew', color: 'text-primary', label: '运行中', spin: true },
  completed: { icon: 'check_circle', color: 'text-emerald-400', label: '已完成' },
  failed: { icon: 'error', color: 'text-red-400', label: '失败' },
  queued: { icon: 'schedule', color: 'text-slate-400', label: '排队中' },
  paused: { icon: 'pause_circle', color: 'text-amber-400', label: '已暂停' },
};

export function TaskCardBlockComponent({ taskId, styleHints, onOpen }: Props) {
  const task = useCockpitStore((s) => s.tasks.find((t) => t.id === taskId));

  if (!task) {
    return (
      <div className={`w-full p-3 ${blockTokens.card} animate-pulse`}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-4 h-4 rounded-full bg-white/10" />
          <div className="h-3 bg-white/10 rounded flex-1" />
        </div>
        <div className={`h-1.5 rounded-full ${blockTokens.progressTrack}`} />
      </div>
    );
  }

  const cfg = statusConfig[task.status];

  return (
    <button
      type="button"
      className={`w-full text-left p-3 ${blockTokens.cardInteractive}`}
      style={styleHints as React.CSSProperties}
      onClick={() => onOpen({ type: 'task-detail', title: task.name, data: { taskId } })}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon
          name={cfg.icon}
          size={16}
          className={`${cfg.color} ${cfg.spin ? 'animate-spin' : ''}`}
        />
        <span className={`text-xs font-medium ${blockTokens.text} truncate flex-1`}>
          {task.name}
        </span>
        <span className={`text-[10px] font-medium ${cfg.color}`}>{cfg.label}</span>
      </div>

      <div className={`h-1.5 rounded-full ${blockTokens.progressTrack}`}>
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            task.status === 'running' ? 'animate-pulse' : ''
          }`}
          style={{ width: `${task.progress}%`, backgroundColor: task.color }}
        />
      </div>

      <div className="mt-1.5 flex items-center justify-between">
        <span className={`text-[10px] ${blockTokens.textMuted}`}>{task.progress}%</span>
        <span className="text-[10px] text-primary/60 flex items-center gap-0.5">
          查看详情 <Icon name="chevron_right" size={12} />
        </span>
      </div>
    </button>
  );
}
