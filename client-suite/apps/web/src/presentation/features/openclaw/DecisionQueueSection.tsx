/**
 * DecisionQueueSection — 待处理决策队列
 *
 * 从 TaskMonitorContent 抽离，展示所有 pending 决策。
 */
import { useOpenClawStore } from '../../../application/stores/openclawStore';
import type { DecisionUrgency } from '../../../domain/agent/DecisionRequest';
import { SignalPrioritizer } from '../../../domain/agent/SignalPrioritizer';

const URGENCY_STYLES: Record<DecisionUrgency, { dot: string; label: string }> = {
  critical: { dot: 'bg-red-400', label: '紧急' },
  high: { dot: 'bg-orange-400', label: '高优' },
  normal: { dot: 'bg-blue-400', label: '一般' },
  low: { dot: 'bg-slate-400', label: '低优' },
};

function formatTimeRemaining(deadline: number): string {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return '已过期';
  const mins = Math.floor(remaining / 60_000);
  if (mins < 60) return `${mins} 分钟`;
  const hours = Math.floor(mins / 60);
  return `${hours} 小时`;
}

export function DecisionQueueSection() {
  const decisionRequests = useOpenClawStore((s) => s.decisionRequests);
  const openDrawer = useOpenClawStore((s) => s.openDrawer);
  const pendingDecisions = SignalPrioritizer.prioritize(
    decisionRequests.filter((d) => d.isPending)
  );

  if (pendingDecisions.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
          <span className="text-xs font-medium text-slate-300">待处理决策</span>
        </div>
        <span className="text-[10px] text-slate-500">{pendingDecisions.length} 项</span>
      </div>
      <div className="space-y-1.5">
        {pendingDecisions.map((decision, index) => {
          const style = URGENCY_STYLES[decision.urgency];
          const isTop = index === 0;
          return (
            <button
              key={decision.id}
              type="button"
              onClick={() =>
                openDrawer({
                  type: 'decision-detail',
                  title: decision.title,
                  data: { decisionId: decision.id },
                })
              }
              className={`w-full p-2 rounded-lg border transition-colors text-left ${
                isTop
                  ? 'border-l-2 border-l-[#007AFF] border-white/10 bg-white/[0.05] hover:bg-white/[0.08]'
                  : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
                <span className="text-[11px] font-medium text-slate-200 truncate flex-1">
                  {decision.title}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 ml-3.5">
                <span className="text-[10px] text-slate-500">{style.label}</span>
                <span className="text-[10px] text-slate-600">·</span>
                <span className="text-[10px] text-slate-500">
                  {formatTimeRemaining(decision.deadline)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
