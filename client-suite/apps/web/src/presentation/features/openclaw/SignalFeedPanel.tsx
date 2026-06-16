/**
 * SignalFeedPanel — 统一信号流视图
 *
 * 按优先级排序展示所有活跃信号，替代 AttentionColumn 中简单列表。
 * 支持按来源/紧急度过滤、信号确认/处理操作。
 */
import { useState, useMemo, useCallback } from 'react';
import { useSignalStore } from '../../../application/stores/signalStore';
import type { Signal, SignalSource, SignalUrgency } from '../../../domain/agent/Signal';
import { SignalPrioritizer } from '../../../domain/agent/SignalPrioritizer';
import { Icon } from '../../components/ui/Icon';

const SOURCE_META: Record<SignalSource, { icon: string; label: string; color: string }> = {
  decision: { icon: 'bolt', label: '决策', color: 'text-orange-400' },
  'task-exception': { icon: 'error_outline', label: '任务异常', color: 'text-red-400' },
  'goal-alert': { icon: 'flag', label: '目标预警', color: 'text-yellow-400' },
  notification: { icon: 'mail', label: '通知', color: 'text-blue-400' },
  'agent-discovery': { icon: 'explore', label: 'Agent 发现', color: 'text-purple-400' },
  'external-alarm': { icon: 'warning', label: '外部告警', color: 'text-red-500' },
  collaboration: { icon: 'group', label: '协作', color: 'text-green-400' },
};

const URGENCY_META: Record<SignalUrgency, { dot: string; label: string }> = {
  critical: { dot: 'bg-red-500 animate-pulse', label: '紧急' },
  high: { dot: 'bg-orange-400', label: '重要' },
  normal: { dot: 'bg-yellow-400', label: '普通' },
  low: { dot: 'bg-slate-400', label: '低' },
};

type FilterSource = SignalSource | 'all';

function formatTimeRemaining(deadline: number): string {
  const diff = deadline - Date.now();
  if (diff <= 0) return '已过期';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

interface SignalCardProps {
  signal: Signal;
  score: number;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
  onSelect: (signal: Signal) => void;
  isSelected: boolean;
}

function SignalCard({
  signal,
  score,
  onAcknowledge,
  onResolve,
  onSelect,
  isSelected,
}: SignalCardProps) {
  const source = SOURCE_META[signal.source];
  const urgency = URGENCY_META[signal.urgency];
  const [now] = useState(Date.now);
  const isOverdue = signal.deadline < now;

  return (
    <button
      type="button"
      onClick={() => onSelect(signal)}
      className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors group ${
        isSelected
          ? 'border-primary/40 bg-primary/[0.08]'
          : signal.status === 'acknowledged'
            ? 'border-white/[0.06] bg-white/[0.01] opacity-70 hover:opacity-90'
            : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
      }`}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full shrink-0 ${urgency.dot}`} />
        <Icon name={source.icon} size={12} className={source.color} />
        <span className="text-xs font-medium text-slate-200 truncate flex-1">
          {signal.payload.title}
        </span>
        <span className="text-[9px] px-1 py-0.5 rounded bg-white/[0.06] text-slate-500 shrink-0">
          {Math.round(score)}
        </span>
      </div>

      {/* Detail row */}
      {signal.payload.detail && (
        <p className="text-[10px] text-slate-400 line-clamp-1 pl-4 mb-1">{signal.payload.detail}</p>
      )}

      {/* Footer row */}
      <div className="flex items-center gap-2 pl-4">
        <span className={`text-[10px] ${source.color}`}>{source.label}</span>
        {signal.agentId && (
          <span className="text-[10px] text-slate-500 truncate max-w-[80px]">{signal.agentId}</span>
        )}
        <span className="flex-1" />
        <span className={`text-[10px] ${isOverdue ? 'text-red-400' : 'text-slate-500'}`}>
          {formatTimeRemaining(signal.deadline)}
        </span>
        {/* Action buttons — visible on hover */}
        <div className="hidden group-hover:flex items-center gap-1">
          {signal.status === 'active' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAcknowledge(signal.id);
              }}
              className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-primary hover:bg-primary/10"
              title="确认"
            >
              <Icon name="visibility" size={11} />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onResolve(signal.id);
            }}
            className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-green-400 hover:bg-green-400/10"
            title="已处理"
          >
            <Icon name="check" size={11} />
          </button>
        </div>
      </div>
    </button>
  );
}

interface SignalFeedPanelProps {
  selectedSignalId?: string | null;
  onSelectSignal?: (signal: Signal) => void;
  maxItems?: number;
}

export function SignalFeedPanel({
  selectedSignalId,
  onSelectSignal,
  maxItems = 50,
}: SignalFeedPanelProps) {
  const signals = useSignalStore((s) => s.signals);
  const acknowledgeSignal = useSignalStore((s) => s.acknowledgeSignal);
  const resolveSignal = useSignalStore((s) => s.resolveSignal);

  const [filterSource, setFilterSource] = useState<FilterSource>('all');
  const [filterUrgency, _setFilterUrgency] = useState<SignalUrgency | 'all'>('all');
  const [showResolved, setShowResolved] = useState(false);

  const [now] = useState(Date.now);

  const scored = useMemo(() => {
    return signals.map((s) => ({
      signal: s,
      score: SignalPrioritizer.computeSignalScore(s, now),
    }));
  }, [signals, now]);

  const filtered = useMemo(() => {
    let items = scored;
    if (!showResolved) {
      items = items.filter((s) => s.signal.status !== 'resolved' && s.signal.status !== 'expired');
    }
    if (filterSource !== 'all') {
      items = items.filter((s) => s.signal.source === filterSource);
    }
    if (filterUrgency !== 'all') {
      items = items.filter((s) => s.signal.urgency === filterUrgency);
    }
    items.sort((a, b) => b.score - a.score);
    return items.slice(0, maxItems);
  }, [scored, filterSource, filterUrgency, showResolved, maxItems]);

  const activeCount = signals.filter((s) => s.status === 'active').length;
  const criticalCount = signals.filter(
    (s) => s.urgency === 'critical' && s.status === 'active'
  ).length;

  const handleSelect = useCallback(
    (signal: Signal) => {
      onSelectSignal?.(signal);
    },
    [onSelectSignal]
  );

  const activeSources = useMemo(() => {
    const set = new Set(signals.map((s) => s.source));
    return Array.from(set) as SignalSource[];
  }, [signals]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <Icon name="sensors" size={16} className="text-primary/80" />
          <span className="text-sm font-medium text-slate-200">信号流</span>
          {activeCount > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500/90 text-white text-[9px] font-bold flex items-center justify-center">
              {activeCount}
            </span>
          )}
          {criticalCount > 0 && (
            <span className="text-[10px] text-red-400 animate-pulse">{criticalCount} 紧急</span>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            type="button"
            onClick={() => setFilterSource('all')}
            className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
              filterSource === 'all'
                ? 'bg-primary/20 text-primary'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            全部
          </button>
          {activeSources.map((src) => (
            <button
              key={src}
              type="button"
              onClick={() => setFilterSource(src === filterSource ? 'all' : src)}
              className={`px-1.5 py-0.5 rounded text-[10px] transition-colors flex items-center gap-0.5 ${
                filterSource === src
                  ? 'bg-primary/20 text-primary'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon name={SOURCE_META[src].icon} size={10} />
              {SOURCE_META[src].label}
            </button>
          ))}
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => setShowResolved(!showResolved)}
            className={`text-[10px] transition-colors ${showResolved ? 'text-primary' : 'text-slate-600 hover:text-slate-400'}`}
          >
            {showResolved ? '隐藏已处理' : '显示已处理'}
          </button>
        </div>
      </div>

      {/* Signal list */}
      <div className="flex-1 overflow-y-auto dcf-scrollbar p-2 space-y-1.5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <Icon name="check_circle" size={32} className="text-slate-600 mb-2" />
            <p className="text-[11px]">暂无活跃信号</p>
          </div>
        ) : (
          filtered.map(({ signal, score }) => (
            <SignalCard
              key={signal.id}
              signal={signal}
              score={score}
              isSelected={selectedSignalId === signal.id}
              onAcknowledge={acknowledgeSignal}
              onResolve={resolveSignal}
              onSelect={handleSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}
