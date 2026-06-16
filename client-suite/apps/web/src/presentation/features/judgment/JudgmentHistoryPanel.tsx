/**
 * JudgmentHistoryPanel — 判断历史 + 质量统计面板
 */
import { Icon } from '../../components/ui/Icon';
import { useJudgmentStore } from '../../../application/stores/judgmentStore';

interface JudgmentHistoryEntry {
  id: string;
  decisionId: string;
  action: string;
  confidence: number;
  responseTimeMs: number;
  timestamp: number;
  outcome?: 'correct' | 'incorrect' | 'pending';
}

const ACTION_META: Record<string, { icon: string; color: string; label: string }> = {
  approve: { icon: 'check_circle', color: 'text-green-400', label: '批准' },
  reject: { icon: 'cancel', color: 'text-red-400', label: '驳回' },
  modify: { icon: 'edit', color: 'text-orange-400', label: '修改' },
  escalate: { icon: 'arrow_upward', color: 'text-blue-400', label: '上报' },
};

const OUTCOME_META: Record<string, { color: string; label: string }> = {
  correct: { color: 'text-green-400 bg-green-400/10', label: '正确' },
  incorrect: { color: 'text-red-400 bg-red-400/10', label: '偏差' },
  pending: { color: 'text-slate-400 bg-slate-400/10', label: '待验' },
};

function formatTime(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

function formatAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 3600_000) return `${Math.round(diff / 60_000)}分钟前`;
  if (diff < 86400_000) return `${Math.round(diff / 3600_000)}小时前`;
  return `${Math.round(diff / 86400_000)}天前`;
}

export function JudgmentHistoryPanel() {
  const records = useJudgmentStore((s) => s.records);

  const history: JudgmentHistoryEntry[] = records.map((r) => ({
    id: r.id,
    decisionId: r.decisionId,
    action: r.action,
    confidence: 0.8,
    responseTimeMs: r.responseDurationMs,
    timestamp: r.createdAt,
    outcome: 'pending',
  }));
  const total = history.length;
  const correct = history.filter((h) => h.outcome === 'correct').length;
  const accuracyRate = total > 0 ? correct / total : 0;
  const avgResponseMs =
    total > 0 ? history.reduce((sum, h) => sum + h.responseTimeMs, 0) / total : 0;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="history" size={16} className="text-primary/80" />
        <span className="text-sm font-medium text-slate-200">判断历史</span>
        <span className="text-[10px] text-slate-500">{total} 条记录</span>
      </div>

      {/* Stats summary */}
      <div className="flex gap-4 mb-3 pb-3 border-b border-white/[0.06]">
        <div className="flex flex-col items-center">
          <span className="text-lg font-bold text-green-400">
            {Math.round(accuracyRate * 100)}%
          </span>
          <span className="text-[9px] text-slate-500">准确率</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-lg font-bold text-blue-400">{formatTime(avgResponseMs)}</span>
          <span className="text-[9px] text-slate-500">平均响应</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-lg font-bold text-slate-300">{total}</span>
          <span className="text-[9px] text-slate-500">总决策数</span>
        </div>
      </div>

      {/* History list */}
      <div className="space-y-1.5">
        {history.map((entry) => {
          const action = ACTION_META[entry.action] ?? ACTION_META.approve;
          const outcome = entry.outcome ? OUTCOME_META[entry.outcome] : null;
          return (
            <div
              key={entry.id}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/[0.03]"
            >
              <Icon name={action.icon} size={13} className={action.color} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-200">{action.label}</span>
                  <span className="text-[9px] text-slate-500">
                    置信度 {Math.round(entry.confidence * 100)}%
                  </span>
                </div>
                <span className="text-[9px] text-slate-600">
                  响应 {formatTime(entry.responseTimeMs)} · {formatAgo(entry.timestamp)}
                </span>
              </div>
              {outcome && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded ${outcome.color}`}>
                  {outcome.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
