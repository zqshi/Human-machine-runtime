/**
 * PatternBoard — 已检测模式看板
 */
import { useState, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useSensingStore } from '../../../application/stores/sensingStore';

export function PatternBoard() {
  const { detectedPatterns, fetchPatterns, subscribeSSE } = useSensingStore();
  const [now] = useState(Date.now);

  useEffect(() => {
    fetchPatterns();
    subscribeSSE();
  }, [fetchPatterns, subscribeSSE]);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="pattern" size={16} className="text-primary/80" />
        <span className="text-sm font-medium text-slate-200">已检测模式</span>
        <span className="text-[10px] text-slate-500">{detectedPatterns.length} 条</span>
      </div>

      <div className="space-y-2">
        {detectedPatterns.length === 0 ? (
          <div className="text-center py-6 text-[11px] text-slate-500">暂无已检测模式</div>
        ) : (
          detectedPatterns.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.03] transition-colors"
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  p.severity === 'high'
                    ? 'bg-red-500'
                    : p.severity === 'medium'
                      ? 'bg-orange-400'
                      : 'bg-yellow-400'
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-200 font-medium">{p.name}</span>
                  <span className="text-[9px] text-slate-500">{p.frequency} 次检测</span>
                </div>
                <span className="text-[10px] text-slate-400">{p.description}</span>
              </div>
              <span className="text-[9px] text-slate-600 shrink-0">
                {Math.round((now - p.lastSeenAt) / 60_000)}m
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
