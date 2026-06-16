/**
 * SignalTimeline — 信号时间轴
 *
 * 按创建时间降序展示信号，比 AttentionColumn 更紧密的时间序列视图。
 * 每条显示来源图标、紧急度点、标题和相对时间。
 */
import type { Signal, SignalSource, SignalUrgency } from '../../../domain/agent/Signal';
import { Icon } from '../../components/ui/Icon';

const SOURCE_ICON: Record<SignalSource, string> = {
  decision: 'bolt',
  'task-exception': 'error_outline',
  'goal-alert': 'flag',
  notification: 'mail',
  'agent-discovery': 'explore',
  'external-alarm': 'warning',
  collaboration: 'group',
};

const SOURCE_COLOR: Record<SignalSource, string> = {
  decision: 'text-orange-400',
  'task-exception': 'text-red-400',
  'goal-alert': 'text-yellow-400',
  notification: 'text-blue-400',
  'agent-discovery': 'text-purple-400',
  'external-alarm': 'text-red-500',
  collaboration: 'text-green-400',
};

const URGENCY_DOT: Record<SignalUrgency, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-400',
  normal: 'bg-yellow-400',
  low: 'bg-slate-400',
};

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return '刚刚';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface SignalTimelineProps {
  signals: readonly Signal[];
  maxItems?: number;
}

export function SignalTimeline({ signals, maxItems = 20 }: SignalTimelineProps) {
  const sorted = [...signals].sort((a, b) => b.createdAt - a.createdAt).slice(0, maxItems);

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center py-6 text-slate-500 text-xs">
        暂无信号记录
      </div>
    );
  }

  return (
    <div className="relative pl-4">
      {/* Vertical line */}
      <div className="absolute left-[7px] top-1 bottom-1 w-px bg-white/10" />

      <div className="space-y-2">
        {sorted.map((signal) => (
          <div key={signal.id} className="relative flex items-start gap-2">
            {/* Timeline dot */}
            <div
              className={`absolute left-[-12px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-[#1a1a2e] ${URGENCY_DOT[signal.urgency]}`}
            />

            {/* Content */}
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <Icon
                name={SOURCE_ICON[signal.source]}
                size={12}
                className={SOURCE_COLOR[signal.source]}
              />
              <span className="text-[11px] text-slate-300 truncate flex-1">
                {signal.payload.title}
              </span>
              <span
                className={`text-[9px] shrink-0 px-1 py-0.5 rounded ${
                  signal.status === 'resolved'
                    ? 'bg-green-400/10 text-green-400'
                    : signal.status === 'expired'
                      ? 'bg-slate-500/10 text-slate-500'
                      : signal.status === 'acknowledged'
                        ? 'bg-blue-400/10 text-blue-400'
                        : 'bg-white/[0.04] text-slate-500'
                }`}
              >
                {signal.status === 'resolved'
                  ? '已处理'
                  : signal.status === 'expired'
                    ? '已过期'
                    : signal.status === 'acknowledged'
                      ? '已确认'
                      : formatRelativeTime(signal.createdAt)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
