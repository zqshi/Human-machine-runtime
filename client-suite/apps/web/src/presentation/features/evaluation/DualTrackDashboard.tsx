/**
 * DualTrackDashboard — Agent 绩效 + 人的判断质量并排看板
 */
import { useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useEvaluationStore } from '../../../application/stores/evaluationStore';

const ADJ_META: Record<string, { icon: string; color: string; label: string }> = {
  promote: { icon: 'trending_up', color: 'text-green-400', label: '升权' },
  maintain: { icon: 'trending_flat', color: 'text-slate-400', label: '维持' },
  demote: { icon: 'trending_down', color: 'text-red-400', label: '降权' },
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-green-400' : score >= 50 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-20 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[10px] text-slate-300 w-8 text-right">{score.toFixed(0)}</span>
    </div>
  );
}

export function DualTrackDashboard() {
  const { scorecards, fetchScorecards, getAgentScorecards, getHumanScorecards } =
    useEvaluationStore();

  useEffect(() => {
    fetchScorecards();
  }, [fetchScorecards]);

  const agentCards = getAgentScorecards();
  const humanCards = getHumanScorecards();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 shrink-0 flex items-center gap-2">
        <Icon name="leaderboard" size={18} className="text-primary/80" />
        <span className="text-sm font-semibold text-slate-200">双轨考核</span>
        <span className="text-[10px] text-slate-500">{scorecards.length} 条记录</span>
      </div>

      <div className="flex-1 overflow-y-auto dcf-scrollbar p-4 space-y-4">
        {/* Agent scorecards */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="smart_toy" size={14} className="text-primary/70" />
            <span className="text-xs font-medium text-slate-200">Agent 绩效</span>
          </div>

          {agentCards.length === 0 ? (
            <div className="text-center py-4 text-[11px] text-slate-500">暂无 Agent 考核数据</div>
          ) : (
            <div className="space-y-2">
              {agentCards.map((card) => {
                const adj = ADJ_META[card.adjustment];
                return (
                  <div
                    key={card.subjectId}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.03]"
                  >
                    <span className="text-[11px] text-slate-200 font-medium w-16">
                      {card.subjectName}
                    </span>
                    <ScoreBar score={card.score} />
                    <span className="text-[10px] text-slate-500">
                      {Math.round((card.metrics?.completionRate ?? 0) * 100)}% 完成
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {Math.round((card.metrics?.acceptanceRate ?? 0) * 100)}% 验收
                    </span>
                    <div className="flex items-center gap-0.5">
                      <Icon name={adj.icon} size={12} className={adj.color} />
                      <span className={`text-[9px] ${adj.color}`}>{adj.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Human scorecards */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="person" size={14} className="text-orange-400/70" />
            <span className="text-xs font-medium text-slate-200">人的判断质量</span>
          </div>

          {humanCards.length === 0 ? (
            <div className="text-center py-4 text-[11px] text-slate-500">暂无人的判断考核数据</div>
          ) : (
            <div className="space-y-2">
              {humanCards.map((card) => {
                const adj = ADJ_META[card.adjustment];
                return (
                  <div
                    key={card.subjectId}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.03]"
                  >
                    <span className="text-[11px] text-slate-200 font-medium w-16">
                      {card.subjectName}
                    </span>
                    <ScoreBar score={card.score} />
                    <span className="text-[10px] text-slate-500">
                      {Math.round((card.metrics?.accuracyRate ?? 0) * 100)}% 准确
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {Math.round((card.metrics?.timelinessRate ?? 0) * 100)}% 及时
                    </span>
                    <div className="flex items-center gap-0.5">
                      <Icon name={adj.icon} size={12} className={adj.color} />
                      <span className={`text-[9px] ${adj.color}`}>{adj.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
