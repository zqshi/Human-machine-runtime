/**
 * StrategicCockpitPage — 战略驾驶舱聚合页面
 */
import { ObjectiveTree } from './ObjectiveTree';
import { ConfidenceDashboard } from './ConfidenceDashboard';
import { StrategicQuestioner } from './StrategicQuestioner';
import { DivisionMatrix } from './DivisionMatrix';
import { Icon } from '../../components/ui/Icon';

export function StrategicCockpitPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0d0d1a]">
      <div className="px-6 py-4 border-b border-white/10 shrink-0 flex items-center gap-2">
        <Icon name="flag" size={20} className="text-primary" />
        <h1 className="text-base font-semibold text-slate-100">战略驾驶舱</h1>
      </div>

      <div className="flex-1 overflow-y-auto dcf-scrollbar p-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-[1400px] mx-auto">
          <ConfidenceDashboard />
          <DivisionMatrix />
          <div className="xl:col-span-2">
            <StrategicQuestioner />
          </div>
          <div className="xl:col-span-2">
            <ObjectiveTree />
          </div>
        </div>
      </div>
    </div>
  );
}
