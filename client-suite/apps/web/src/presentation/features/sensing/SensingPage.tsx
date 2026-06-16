/**
 * SensingPage — 感知与反馈回路聚合页面
 */
import { SignalRadar } from './SignalRadar';
import { PatternBoard } from './PatternBoard';
import { Icon } from '../../components/ui/Icon';

export function SensingPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0d0d1a]">
      <div className="px-6 py-4 border-b border-white/10 shrink-0 flex items-center gap-2">
        <Icon name="radar" size={20} className="text-primary" />
        <h1 className="text-base font-semibold text-slate-100">感知与反馈</h1>
      </div>

      <div className="flex-1 overflow-y-auto hmr-scrollbar p-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-[1400px] mx-auto">
          <SignalRadar />
          <PatternBoard />
        </div>
      </div>
    </div>
  );
}
