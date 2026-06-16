import { useMemo } from 'react';
import { useJudgmentStore } from '../../../application/stores/judgmentStore';
import { Icon } from '../../components/ui/Icon';
import type { DecisionResponseStatus } from '../../../domain/agent/DecisionRequest';

const STATUS_META: Record<DecisionResponseStatus, { icon: string; label: string; color: string }> =
  {
    pending: { icon: 'hourglass_empty', label: '待处理', color: 'text-slate-400' },
    accepted: { icon: 'check_circle', label: '已采纳', color: 'text-green-400' },
    modified: { icon: 'edit', label: '已修改', color: 'text-blue-400' },
    declined: { icon: 'cancel', label: '已拒绝', color: 'text-red-400' },
    deferred: { icon: 'schedule', label: '已延迟', color: 'text-orange-400' },
    expired: { icon: 'timer_off', label: '已过期', color: 'text-slate-500' },
  };

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}秒`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}分钟`;
  return `${(ms / 3_600_000).toFixed(1)}小时`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

interface Props {
  decisionId?: string;
  maxItems?: number;
}

export function JudgmentRecordTimeline({ decisionId, maxItems = 20 }: Props) {
  const allRecords = useJudgmentStore((s) => s.records);

  const visible = useMemo(() => {
    const filtered = decisionId
      ? allRecords.filter((r) => r.decisionId === decisionId)
      : allRecords;
    return filtered.slice(0, maxItems);
  }, [allRecords, decisionId, maxItems]);

  if (visible.length === 0) return null;

  return (
    <div className="mx-3 my-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon name="history" size={14} className="text-primary/70" />
        <span className="text-xs font-medium text-slate-200">判断记录</span>
        <span className="text-[10px] text-slate-500">{visible.length} 条</span>
      </div>

      <div className="space-y-1.5">
        {visible.map((record) => {
          const meta = STATUS_META[record.action] ?? STATUS_META.pending;
          return (
            <div key={record.id} className="flex items-start gap-2 pl-1">
              <div className="mt-0.5 flex-shrink-0">
                <Icon name={meta.icon} size={12} className={meta.color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[11px] font-medium ${meta.color}`}>{meta.label}</span>
                  <span className="text-[10px] text-slate-500 truncate">
                    {record.contextSnapshot.title}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-500">
                    {formatTime(record.respondedAt)}
                  </span>
                  <span className="text-[10px] text-slate-600">
                    响应耗时 {formatDuration(record.responseDurationMs)}
                  </span>
                </div>
                {record.feedback && (
                  <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                    &ldquo;{record.feedback}&rdquo;
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
