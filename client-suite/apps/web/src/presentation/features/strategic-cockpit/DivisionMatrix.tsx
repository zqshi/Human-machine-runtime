/**
 * DivisionMatrix — 确定性×风险四象限图
 */
import { useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useObjectiveStore } from '../../../application/stores/objectiveStore';

interface DivisionItem {
  id: string;
  label: string;
  determinism: number;
  risk: number;
  mode: 'auto' | 'human-approve' | 'human-review' | 'human-lead';
}

const MODE_META: Record<string, { color: string; bg: string; label: string }> = {
  auto: { color: 'text-green-400', bg: 'bg-green-400', label: 'AI 自主' },
  'human-approve': { color: 'text-blue-400', bg: 'bg-blue-400', label: '人审批' },
  'human-review': { color: 'text-orange-400', bg: 'bg-orange-400', label: '人选择' },
  'human-lead': { color: 'text-red-400', bg: 'bg-red-400', label: '人主导' },
};

export function DivisionMatrix() {
  const { objectives, fetch: fetchObjectives } = useObjectiveStore();

  useEffect(() => {
    fetchObjectives();
  }, [fetchObjectives]);

  const items: DivisionItem[] = objectives
    .filter((o) => o.level === 'L2')
    .map((o) => {
      const determinism = o.confidence;
      const risk = 1 - o.confidence;
      const mode: DivisionItem['mode'] =
        determinism >= 0.8 && risk < 0.5
          ? 'auto'
          : determinism >= 0.6 && risk >= 0.5
            ? 'human-approve'
            : determinism < 0.6 && risk < 0.5
              ? 'human-review'
              : 'human-lead';
      return { id: o.id, label: o.title, determinism, risk, mode };
    });

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="grid_view" size={16} className="text-primary/80" />
        <span className="text-sm font-medium text-slate-200">人机分工矩阵</span>
      </div>

      {/* Quadrant labels */}
      <div className="relative aspect-square max-w-[320px] mx-auto border border-white/10 rounded-lg bg-white/[0.02] mb-3 p-1">
        {/* Axis labels */}
        <div className="absolute left-1/2 -top-5 -translate-x-1/2 text-[9px] text-slate-500">
          高确定性
        </div>
        <div className="absolute left-1/2 -bottom-5 -translate-x-1/2 text-[9px] text-slate-500">
          低确定性
        </div>
        <div className="absolute top-1/2 -left-8 -translate-y-1/2 -rotate-90 text-[9px] text-slate-500">
          低风险
        </div>
        <div className="absolute top-1/2 -right-8 -translate-y-1/2 rotate-90 text-[9px] text-slate-500">
          高风险
        </div>

        {/* Center lines */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/[0.08]" />
        <div className="absolute top-1/2 left-0 right-0 h-px bg-white/[0.08]" />

        {/* Quadrant labels */}
        <div className="absolute top-2 left-2 text-[8px] text-green-400/50">AI 自主</div>
        <div className="absolute top-2 right-2 text-[8px] text-blue-400/50">人审批</div>
        <div className="absolute bottom-2 left-2 text-[8px] text-orange-400/50">人选择</div>
        <div className="absolute bottom-2 right-2 text-[8px] text-red-400/50">人主导</div>

        {/* Items as dots */}
        {items.map((item) => {
          const x = item.risk * 100;
          const y = (1 - item.determinism) * 100;
          const meta = MODE_META[item.mode];
          return (
            <div
              key={item.id}
              className={`absolute w-3 h-3 rounded-full ${meta.bg} shadow-lg cursor-default`}
              style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
              title={`${item.label} (${meta.label})`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="space-y-1">
        {items.map((item) => {
          const meta = MODE_META[item.mode];
          return (
            <div key={item.id} className="flex items-center gap-2 text-[10px]">
              <span className={`w-2 h-2 rounded-full ${meta.bg}`} />
              <span className="text-slate-300 flex-1">{item.label}</span>
              <span className={meta.color}>{meta.label}</span>
              <span className="text-slate-500">确定性 {Math.round(item.determinism * 100)}%</span>
              <span className="text-slate-500">风险 {Math.round(item.risk * 100)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
