/**
 * DecisionRequestCard — 嵌入对话中的决策请求卡片
 *
 * AI 在自主执行中遇到需要人判断的节点时，渲染此卡片。
 * 用户可一键采纳、修改、自己处理或延后。
 */
import type { DecisionRequest } from '../../../domain/agent/DecisionRequest';
import { Icon } from '../../components/ui/Icon';

const URGENCY_STYLES: Record<string, { dot: string; label: string }> = {
  critical: { dot: 'bg-red-500 animate-pulse', label: '紧急' },
  high: { dot: 'bg-orange-500', label: '重要' },
  normal: { dot: 'bg-yellow-500', label: '普通' },
  low: { dot: 'bg-slate-500', label: '低优' },
};

function formatDeadline(ts: number): string {
  const diff = ts - Date.now();
  if (diff <= 0) return '已过期';
  if (diff < 60_000) return `${Math.ceil(diff / 1000)}秒`;
  if (diff < 3_600_000) return `${Math.ceil(diff / 60_000)}分钟`;
  return `${Math.ceil(diff / 3_600_000)}小时`;
}

interface DecisionRequestCardProps {
  decision: DecisionRequest;
  onAccept: () => void;
  onViewDetail: () => void;
  onDefer: () => void;
}

export function DecisionRequestCard({ decision, onAccept, onViewDetail, onDefer }: DecisionRequestCardProps) {
  const urgency = URGENCY_STYLES[decision.urgency] ?? URGENCY_STYLES.normal;

  if (decision.responseStatus !== 'pending') {
    const statusLabels: Record<string, string> = {
      accepted: '已采纳',
      modified: '已修改',
      declined: '已拒绝',
      deferred: '已延后',
      expired: '已过期',
    };
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 opacity-60">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Icon name="check_circle" size={14} className="text-slate-500" />
          <span>{decision.title}</span>
          <span className="text-[10px] text-slate-500">— {statusLabels[decision.responseStatus]}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/[0.04] p-3 space-y-2.5 animate-[dcf-fade-in_0.2s_ease-out]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${urgency.dot}`} />
          <span className="text-xs font-medium text-slate-100">{decision.title}</span>
        </div>
        <span className="text-[10px] text-slate-500">剩余 {formatDeadline(decision.deadline)}</span>
      </div>

      {/* Context */}
      <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{decision.context}</p>

      {/* Recommendation */}
      <div className="rounded-md bg-primary/10 border border-primary/20 p-2.5 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Icon name="auto_awesome" size={12} className="text-primary" />
          <span className="text-[11px] font-medium text-primary">AI 推荐</span>
        </div>
        <p className="text-xs text-slate-200 font-medium">{decision.recommendation.label}</p>
        <p className="text-[11px] text-slate-400">{decision.recommendation.reasoning}</p>
      </div>

      {/* Actions */}
      <div className="flex gap-1.5">
        <button
          onClick={onAccept}
          className="flex-1 h-7 rounded-md bg-primary text-[10px] text-white font-medium hover:bg-primary-dark transition-colors flex items-center justify-center gap-1"
        >
          <Icon name="check" size={12} />
          采纳
        </button>
        <button
          onClick={onViewDetail}
          className="flex-1 h-7 rounded-md border border-white/10 text-[10px] text-slate-300 hover:bg-white/5 transition-colors flex items-center justify-center gap-1"
        >
          <Icon name="tune" size={12} />
          对比方案
        </button>
        <button
          onClick={onDefer}
          className="w-7 h-7 rounded-md border border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-colors flex items-center justify-center"
          title="延后处理"
        >
          <Icon name="schedule" size={14} />
        </button>
      </div>
    </div>
  );
}
