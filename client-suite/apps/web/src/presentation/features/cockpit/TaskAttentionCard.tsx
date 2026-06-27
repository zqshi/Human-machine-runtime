/**
 * TaskAttentionCard — 左栏 A 栏紧凑任务卡片（240px）
 *
 * 展示任务名、进度条、当前子任务、推理摘要。
 */
import { Icon } from '../../components/ui/Icon';
import type { AttentionItem } from '../../../domain/agent/DrawerContent';

interface TaskAttentionCardProps {
  item: AttentionItem;
  isSelected: boolean;
  onClick: () => void;
}

export function TaskAttentionCard({ item, isSelected, onClick }: TaskAttentionCardProps) {
  const progress = item.taskProgress ?? 0;
  const color = item.taskColor ?? '#007AFF';
  const isResolved = item.resolved;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
        isSelected
          ? 'border-primary/40 bg-primary/[0.08]'
          : isResolved
            ? 'border-white/[0.06] bg-white/[0.01] opacity-60 hover:opacity-80'
            : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
      }`}
    >
      {/* Header: icon + name + progress */}
      <div className="flex items-center gap-2 mb-1.5">
        <Icon
          name={isResolved ? 'check_circle' : 'pending'}
          size={12}
          className={`shrink-0 ${isResolved ? 'text-slate-600' : ''}`}
          style={!isResolved ? { color } : undefined}
        />
        <span className={`text-xs truncate flex-1 ${isResolved ? 'text-slate-400' : 'font-medium text-slate-200'}`}>
          {item.title}
        </span>
        <span className={`text-[10px] shrink-0 ${isResolved ? 'text-slate-600' : 'font-medium text-slate-400'}`}>{progress}%</span>
      </div>

      {/* Progress bar — completed tasks use muted style */}
      {!isResolved && (
        <div className="h-1 rounded-full bg-white/10 overflow-hidden mb-1.5">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, backgroundColor: color }}
          />
        </div>
      )}

      {/* Current subtask (only for active tasks) */}
      {item.currentSubtask && !isResolved && (
        <div className="flex items-center gap-1 pl-4 mb-1">
          <Icon name="autorenew" size={10} className="text-slate-500 shrink-0" />
          <span className="text-[10px] text-slate-400 truncate">{item.currentSubtask}</span>
        </div>
      )}

      {/* Reasoning summary (only for active tasks) */}
      {item.reasoningSummary && !isResolved && (
        <div className="flex items-start gap-1 pl-4">
          <Icon name="psychology" size={10} className="text-primary/50 shrink-0 mt-0.5" />
          <span className="text-[10px] text-slate-500 line-clamp-1">{item.reasoningSummary}</span>
        </div>
      )}

      {/* Status label */}
      {item.taskStatusLabel && (
        <div className="mt-1.5 pl-4">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${
            isResolved
              ? item.taskStatusLabel === '已完成'
                ? 'bg-green-500/10 text-green-500/60'
                : 'bg-red-500/10 text-red-500/60'
              : 'bg-white/[0.04] text-slate-500'
          }`}>
            {item.taskStatusLabel}
          </span>
        </div>
      )}
    </button>
  );
}
