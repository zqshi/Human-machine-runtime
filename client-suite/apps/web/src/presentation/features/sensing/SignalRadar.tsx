/**
 * SignalRadar — 信号雷达图：实时涌现信号流
 */
import { useState, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useSensingStore } from '../../../application/stores/sensingStore';

const SEVERITY_META: Record<string, { color: string; bg: string; dot: string }> = {
  critical: {
    color: 'text-red-400',
    bg: 'bg-red-400/10 border-red-400/20',
    dot: 'bg-red-500 animate-pulse',
  },
  high: {
    color: 'text-orange-400',
    bg: 'bg-orange-400/10 border-orange-400/20',
    dot: 'bg-orange-400',
  },
  medium: {
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10 border-yellow-400/20',
    dot: 'bg-yellow-400',
  },
  low: { color: 'text-slate-400', bg: 'bg-slate-400/10 border-slate-400/20', dot: 'bg-slate-400' },
};

export function SignalRadar() {
  const { emergentSignals, fetchEmergentSignals, subscribeSSE } = useSensingStore();
  const [now] = useState(Date.now);

  useEffect(() => {
    fetchEmergentSignals();
    subscribeSSE();
  }, [fetchEmergentSignals, subscribeSSE]);

  const activeCount = emergentSignals.filter((s) => s.status === 'active').length;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="radar" size={16} className="text-primary/80" />
        <span className="text-sm font-medium text-slate-200">信号雷达</span>
        {activeCount > 0 && (
          <span className="min-w-[16px] h-[16px] px-1 rounded-full bg-red-500/80 text-white text-[9px] font-bold flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {emergentSignals.length === 0 ? (
          <div className="text-center py-6 text-[11px] text-slate-500">暂无涌现信号</div>
        ) : (
          emergentSignals.map((signal) => {
            const sev = SEVERITY_META[signal.severity];
            return (
              <div key={signal.id} className={`rounded-lg border p-3 ${sev.bg}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${sev.dot}`} />
                  <span className="text-[11px] font-medium text-slate-200 flex-1">
                    {signal.pattern}
                  </span>
                  <span className={`text-[9px] ${sev.color}`}>{signal.severity.toUpperCase()}</span>
                </div>
                <div className="flex items-center gap-2 pl-4">
                  <span className="text-[10px] text-slate-500">
                    {signal.correlatedSignalIds.length} 关联信号
                  </span>
                  <span className="text-[10px] text-slate-400">| {signal.suggestedAction}</span>
                </div>
                <div className="flex items-center gap-2 pl-4 mt-1">
                  <span className="text-[9px] text-slate-600">
                    {Math.round((now - signal.createdAt) / 60_000)}m 前检测
                  </span>
                  <span
                    className={`text-[9px] px-1 py-0.5 rounded ${
                      signal.status === 'active'
                        ? 'bg-red-400/10 text-red-400'
                        : signal.status === 'acknowledged'
                          ? 'bg-blue-400/10 text-blue-400'
                          : 'bg-green-400/10 text-green-400'
                    }`}
                  >
                    {signal.status === 'active'
                      ? '待处理'
                      : signal.status === 'acknowledged'
                        ? '已确认'
                        : '已解决'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
