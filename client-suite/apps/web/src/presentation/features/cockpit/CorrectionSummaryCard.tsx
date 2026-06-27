import { useCockpitStore } from '../../../application/stores/cockpitStore';
import type { CorrectionAction } from '../../../domain/agent/CorrectionPropagator';
import { Icon } from '../../components/ui/Icon';

const ACTION_LABELS: Record<CorrectionAction, { text: string; color: string; icon: string }> = {
  continue: { text: '继续', color: 'text-green-400', icon: 'play_arrow' },
  're-evaluate': { text: '重新评估', color: 'text-orange-400', icon: 'refresh' },
  pause: { text: '暂停', color: 'text-red-400', icon: 'pause' },
};

export function CorrectionSummaryCard() {
  const plan = useCockpitStore((s) => s.lastCorrectionPlan);

  if (!plan) return null;

  const total =
    plan.affectedTasks.length + plan.affectedGoals.length + plan.affectedChainNodes.length;
  if (total === 0) return null;

  return (
    <div className="mx-3 my-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon name="account_tree" size={14} className="text-primary/70" />
        <span className="text-xs font-medium text-slate-200">纠偏传播</span>
        <span className="text-[10px] text-slate-500">影响 {total} 个实体</span>
      </div>

      {plan.affectedTasks.length > 0 && (
        <div className="mb-1.5">
          <span className="text-[10px] text-slate-500 mb-0.5 block">
            任务 ({plan.affectedTasks.length})
          </span>
          {plan.affectedTasks.map((t) => {
            const a = ACTION_LABELS[t.suggestedAction];
            return (
              <div key={t.taskId} className="flex items-center gap-2 py-0.5 pl-2">
                <Icon name={a.icon} size={11} className={a.color} />
                <span className="text-[11px] text-slate-300 truncate flex-1">{t.taskName}</span>
                <span className={`text-[10px] ${a.color}`}>{a.text}</span>
              </div>
            );
          })}
        </div>
      )}

      {plan.affectedGoals.length > 0 && (
        <div className="mb-1.5">
          <span className="text-[10px] text-slate-500 mb-0.5 block">
            目标 ({plan.affectedGoals.length})
          </span>
          {plan.affectedGoals.map((g) => {
            const a = ACTION_LABELS[g.suggestedAction];
            return (
              <div key={g.goalId} className="flex items-center gap-2 py-0.5 pl-2">
                <Icon name={a.icon} size={11} className={a.color} />
                <span className="text-[11px] text-slate-300 truncate flex-1">{g.goalTitle}</span>
                <span className={`text-[10px] ${a.color}`}>{a.text}</span>
              </div>
            );
          })}
        </div>
      )}

      {plan.affectedChainNodes.length > 0 && (
        <div>
          <span className="text-[10px] text-slate-500 mb-0.5 block">
            协作节点 ({plan.affectedChainNodes.length})
          </span>
          {plan.affectedChainNodes.map((c) => {
            const a = ACTION_LABELS[c.suggestedAction];
            return (
              <div key={`${c.chainId}-${c.nodeId}`} className="flex items-center gap-2 py-0.5 pl-2">
                <Icon name={a.icon} size={11} className={a.color} />
                <span className="text-[11px] text-slate-300 truncate flex-1">{c.chainName}</span>
                <span className={`text-[10px] ${a.color}`}>{a.text}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
