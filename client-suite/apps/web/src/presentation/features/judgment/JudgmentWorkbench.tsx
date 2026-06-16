/**
 * JudgmentWorkbench — 判断工作台
 *
 * 独立页面级组件，包含：
 * - 判断质量统计面板（JudgmentAnalytics）
 * - 信号时间轴（SignalTimeline）
 * - 判断记录列表
 */
import { useMemo } from 'react';
import { useJudgmentStore } from '../../../application/stores/judgmentStore';
import { useSignalStore } from '../../../application/stores/signalStore';
import {
  JudgmentAnalytics,
  type JudgmentAnalyticsSnapshot,
} from '../../../domain/agent/JudgmentAnalytics';
import type { DecisionResponseStatus } from '../../../domain/agent/DecisionRequest';
import { Icon } from '../../components/ui/Icon';
import { SignalTimeline } from './SignalTimeline';

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
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function AnalyticsCard({ analytics }: { analytics: JudgmentAnalyticsSnapshot }) {
  const { actionDistribution: dist, timeliness, responseTime } = analytics;
  const total = analytics.totalRecords;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="analytics" size={16} className="text-primary/80" />
        <span className="text-sm font-medium text-slate-200">判断质量统计</span>
        <span className="text-[10px] text-slate-500">{total} 条记录</span>
      </div>

      {total === 0 ? (
        <p className="text-xs text-slate-500">暂无判断记录</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {/* Response time */}
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
            <span className="text-[10px] text-slate-500 block mb-1">响应时间</span>
            <div className="text-lg font-semibold text-slate-200">
              {formatDuration(responseTime.median)}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-slate-500">
                P90: {formatDuration(responseTime.p90)}
              </span>
              <span className="text-[10px] text-slate-500">
                均值: {formatDuration(responseTime.mean)}
              </span>
            </div>
          </div>

          {/* Timeliness */}
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
            <span className="text-[10px] text-slate-500 block mb-1">及时率</span>
            <div className="text-lg font-semibold text-slate-200">
              {(timeliness.onTimeRate * 100).toFixed(0)}%
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-green-400">{timeliness.onTime} 及时</span>
              <span className="text-[10px] text-red-400">{timeliness.late} 超时</span>
            </div>
          </div>

          {/* Action distribution */}
          <div className="col-span-2 rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
            <span className="text-[10px] text-slate-500 block mb-2">动作分布</span>
            <div className="flex items-center gap-3 flex-wrap">
              {(Object.entries(dist) as [DecisionResponseStatus, number][])
                .filter(([, v]) => v > 0)
                .map(([action, count]) => {
                  const meta = STATUS_META[action];
                  return (
                    <div key={action} className="flex items-center gap-1">
                      <Icon name={meta.icon} size={12} className={meta.color} />
                      <span className={`text-[11px] ${meta.color}`}>{meta.label}</span>
                      <span className="text-[10px] text-slate-500">{count}</span>
                    </div>
                  );
                })}
            </div>
            {/* Mini bar chart */}
            <div className="flex h-2 mt-2 rounded-full overflow-hidden bg-white/[0.04]">
              {dist.accepted > 0 && (
                <div
                  className="bg-green-400/70"
                  style={{ width: `${(dist.accepted / total) * 100}%` }}
                />
              )}
              {dist.modified > 0 && (
                <div
                  className="bg-blue-400/70"
                  style={{ width: `${(dist.modified / total) * 100}%` }}
                />
              )}
              {dist.declined > 0 && (
                <div
                  className="bg-red-400/70"
                  style={{ width: `${(dist.declined / total) * 100}%` }}
                />
              )}
              {dist.deferred > 0 && (
                <div
                  className="bg-orange-400/70"
                  style={{ width: `${(dist.deferred / total) * 100}%` }}
                />
              )}
              {dist.expired > 0 && (
                <div
                  className="bg-slate-500/70"
                  style={{ width: `${(dist.expired / total) * 100}%` }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RecordList({ maxItems = 30 }: { maxItems?: number }) {
  const records = useJudgmentStore((s) => s.records);
  const visible = records.slice(0, maxItems);

  if (visible.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-500 text-xs">
        暂无判断记录
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {visible.map((record) => {
        const meta = STATUS_META[record.action] ?? STATUS_META.pending;
        return (
          <div
            key={record.id}
            className="flex items-start gap-2 px-3 py-2 rounded-lg hover:bg-white/[0.03] transition-colors"
          >
            <div className="mt-0.5 shrink-0">
              <Icon name={meta.icon} size={14} className={meta.color} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                <span className="text-[11px] text-slate-300 truncate">
                  {record.contextSnapshot.title}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-slate-500">{formatTime(record.respondedAt)}</span>
                <span className="text-[10px] text-slate-600">
                  耗时 {formatDuration(record.responseDurationMs)}
                </span>
                <span className="text-[10px] text-slate-600">
                  {record.contextSnapshot.alternativeCount} 选项
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
  );
}

export function JudgmentWorkbench() {
  const records = useJudgmentStore((s) => s.records);
  const signals = useSignalStore((s) => s.signals);

  const analytics = useMemo(() => JudgmentAnalytics.compute(records), [records]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top header */}
      <div className="px-4 py-3 border-b border-white/10 shrink-0 flex items-center gap-2">
        <Icon name="gavel" size={18} className="text-primary/80" />
        <span className="text-sm font-semibold text-slate-200">判断工作台</span>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto dcf-scrollbar p-4 space-y-4">
        {/* Analytics overview */}
        <AnalyticsCard analytics={analytics} />

        {/* Signal timeline */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="timeline" size={16} className="text-primary/80" />
            <span className="text-sm font-medium text-slate-200">信号时间轴</span>
            <span className="text-[10px] text-slate-500">{signals.length} 信号</span>
          </div>
          <SignalTimeline signals={signals} maxItems={20} />
        </div>

        {/* Judgment record list */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="history" size={16} className="text-primary/80" />
            <span className="text-sm font-medium text-slate-200">判断记录</span>
            <span className="text-[10px] text-slate-500">{records.length} 条</span>
          </div>
          <RecordList />
        </div>
      </div>
    </div>
  );
}
