/**
 * DecisionAttentionCard — A 栏待决策紧凑卡片
 */
import { useState, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';

const URGENCY_COLORS: Record<string, string> = {
  critical: 'bg-red-400 animate-pulse',
  high: 'bg-orange-400',
  normal: 'bg-yellow-400',
  low: 'bg-slate-400',
};

const URGENCY_LABEL: Record<string, string> = {
  critical: '紧急',
  high: '重要',
  normal: '普通',
  low: '低',
};

function formatCountdown(deadline: number): string {
  const diff = deadline - Date.now();
  if (diff <= 0) return '已过期';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} 分钟后`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时后`;
  return `${Math.floor(hours / 24)} 天后`;
}

interface DecisionAttentionCardProps {
  title: string;
  urgency?: string;
  deadline?: number;
  summary?: string;
  isSelected: boolean;
  onClick: () => void;
}

export function DecisionAttentionCard({
  title,
  urgency,
  deadline,
  summary,
  isSelected,
  onClick,
}: DecisionAttentionCardProps) {
  const [countdown, setCountdown] = useState(() => (deadline ? formatCountdown(deadline) : ''));
  const [now] = useState(Date.now);
  useEffect(() => {
    if (!deadline) return;
    const timer = setInterval(() => setCountdown(formatCountdown(deadline)), 30_000);
    return () => clearInterval(timer);
  }, [deadline]);

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
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${urgency ? URGENCY_COLORS[urgency] : 'bg-yellow-400'}`}
        />
        <span className="text-xs font-medium text-slate-200 truncate flex-1">{title}</span>
        {urgency && urgency !== 'normal' && (
          <span className="text-[9px] px-1 py-0.5 rounded shrink-0 bg-white/[0.06] text-slate-400">
            {URGENCY_LABEL[urgency]}
          </span>
        )}
      </div>

      {/* Summary */}
      {summary && <p className="text-[10px] text-slate-400 line-clamp-1 pl-4">{summary}</p>}

      {/* Countdown */}
      {countdown && (
        <div className="flex items-center gap-1 pl-4 mt-0.5">
          <Icon name="schedule" size={10} className="text-slate-500" />
          <span
            className={`text-[10px] ${deadline && deadline - now < 600_000 ? 'text-red-400' : 'text-slate-500'}`}
          >
            {countdown}
          </span>
        </div>
      )}
    </button>
  );
}
