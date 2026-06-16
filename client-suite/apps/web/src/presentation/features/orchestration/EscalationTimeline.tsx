/**
 * EscalationTimeline — 升级链进度视图
 */
import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import type { EscalationEvent } from '../../../application/stores/collaborationStore';

const STAGE_META: Record<string, { icon: string; color: string; label: string }> = {
  retry: { icon: 'replay', color: 'text-blue-400', label: '重试' },
  degrade: { icon: 'compress', color: 'text-orange-400', label: '降级' },
  'swap-agent': { icon: 'swap_horiz', color: 'text-purple-400', label: '换 Agent' },
  'escalate-human': { icon: 'person', color: 'text-red-400', label: '升级给人' },
};

const STATUS_DOT: Record<string, string> = {
  active: 'bg-orange-400 animate-pulse',
  resolved: 'bg-green-400',
  escalated: 'bg-red-400',
};

export function EscalationTimeline({ events = [] }: { events?: EscalationEvent[] }) {
  const [now] = useState(Date.now);

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon name="stacked_line_chart" size={14} className="text-primary/70" />
          <span className="text-xs font-medium text-slate-200">升级链</span>
        </div>
        <p className="text-[11px] text-slate-500 text-center py-4">暂无升级事件</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="stacked_line_chart" size={14} className="text-primary/70" />
        <span className="text-xs font-medium text-slate-200">升级链</span>
        <span className="text-[10px] text-slate-500">{events.length} 事件</span>
      </div>

      <div className="space-y-2">
        {events.map((event) => {
          const stage = STAGE_META[event.stage] ?? STAGE_META.retry;
          return (
            <div
              key={event.id}
              className="flex items-start gap-2 p-2 rounded-lg hover:bg-white/[0.03] transition-colors"
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${STATUS_DOT[event.status]}`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Icon name={stage.icon} size={12} className={stage.color} />
                  <span className={`text-[10px] ${stage.color}`}>{stage.label}</span>
                  <span className="text-[11px] text-slate-300 truncate">{event.taskName}</span>
                </div>
                {event.reason && (
                  <p className="text-[10px] text-slate-500 mt-0.5 pl-4">{event.reason}</p>
                )}
              </div>
              <span className="text-[9px] text-slate-600 shrink-0">
                {Math.round((now - event.timestamp) / 60_000)}m ago
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
