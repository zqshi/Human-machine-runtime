/**
 * GoalAttentionCard — A 栏战略目标紧凑卡片
 */
import type { GoalPriority } from '../../../domain/agent/UserGoal';

const PRIORITY_DOT: Record<GoalPriority, string> = {
  critical: 'bg-red-400',
  high: 'bg-orange-400',
  normal: 'bg-blue-400',
  low: 'bg-slate-400',
};

const PRIORITY_LABEL: Record<GoalPriority, string> = {
  critical: '紧急',
  high: '重要',
  normal: '普通',
  low: '低',
};

interface GoalAttentionCardProps {
  title: string;
  progress: number;
  priority?: GoalPriority;
  milestones?: Array<{ name: string; status: string }>;
  isSelected: boolean;
  onClick: () => void;
}

export function GoalAttentionCard({ title, progress, priority, milestones, isSelected, onClick }: GoalAttentionCardProps) {
  const milestoneSummary = milestones && milestones.length > 0
    ? milestones.map((m) => m.name).join(' → ')
    : '';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
        isSelected
          ? 'border-primary/40 bg-primary/[0.08]'
          : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
      }`}
    >
      {/* Title row */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`w-2 h-2 rounded-full shrink-0 ${priority ? PRIORITY_DOT[priority] : 'bg-blue-400'}`} />
        <span className="text-xs font-medium text-slate-200 truncate flex-1">{title}</span>
        <span className="text-[10px] text-slate-500 shrink-0">{progress}%</span>
        {priority && priority !== 'normal' && (
          <span className="text-[9px] px-1 py-0.5 rounded shrink-0 bg-white/[0.06] text-slate-400">
            {PRIORITY_LABEL[priority]}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-white/10 overflow-hidden mb-1.5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-green-400 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Milestone summary */}
      {milestoneSummary && (
        <p className="text-[10px] text-slate-500 truncate">{milestoneSummary}</p>
      )}
    </button>
  );
}
