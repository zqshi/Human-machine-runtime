/**
 * ConfidenceDashboard — 置信度仪表盘（环形图 + 趋势）
 */
import { useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useObjectiveStore } from '../../../application/stores/objectiveStore';

interface ConfidenceMetric {
  label: string;
  value: number;
  color: string;
}

function CircularGauge({
  value,
  size = 80,
  color,
}: {
  value: number;
  size?: number;
  color: string;
}) {
  const pct = Math.round(value * 100);
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={4}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute text-sm font-semibold text-slate-200">{pct}%</span>
    </div>
  );
}

export function ConfidenceDashboard() {
  const { objectives, fetch: fetchObjectives } = useObjectiveStore();

  useEffect(() => {
    fetchObjectives();
  }, [fetchObjectives]);

  const l0 = objectives.filter((o) => o.level === 'L0');
  const l1 = objectives.filter((o) => o.level === 'L1');
  const l2 = objectives.filter((o) => o.level === 'L2');

  const avg = (items: { confidence: number }[]) =>
    items.length > 0 ? items.reduce((s, i) => s + i.confidence, 0) / items.length : 0;
  const l2CompletionRate =
    l2.length > 0 ? l2.filter((o) => o.status === 'completed').length / l2.length : 0;

  const metrics: ConfidenceMetric[] = [
    { label: '整体置信度', value: avg(l0), color: '#007AFF' },
    { label: 'L2 完成率', value: l2CompletionRate, color: '#34C759' },
    { label: 'L1 置信度', value: avg(l1), color: '#AF52DE' },
    { label: 'L0 置信度', value: avg(l0), color: '#FF9500' },
  ];

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="speed" size={16} className="text-primary/80" />
        <span className="text-sm font-medium text-slate-200">置信度仪表盘</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="flex flex-col items-center gap-2">
            <CircularGauge value={m.value} color={m.color} />
            <span className="text-[10px] text-slate-400 text-center">{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
