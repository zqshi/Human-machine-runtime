/**
 * EvaluationPage — 双轨考核聚合页面
 */
import { DualTrackDashboard } from './DualTrackDashboard';
import { DecisionPatternLibrary } from '../knowledge/DecisionPatternLibrary';
import { Icon } from '../../components/ui/Icon';

export function EvaluationPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0d0d1a]">
      <div className="px-6 py-4 border-b border-white/10 shrink-0 flex items-center gap-2">
        <Icon name="leaderboard" size={20} className="text-primary" />
        <h1 className="text-base font-semibold text-slate-100">考核与知识</h1>
      </div>

      <div className="flex-1 overflow-y-auto dcf-scrollbar p-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-[1400px] mx-auto">
          <DualTrackDashboard />
          <DecisionPatternLibrary />
        </div>
      </div>
    </div>
  );
}
