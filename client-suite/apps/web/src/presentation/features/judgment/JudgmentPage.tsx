/**
 * JudgmentPage — 人机判断界面聚合页面
 */
import { useState, useEffect } from 'react';
import { JudgmentWorkbench } from './JudgmentWorkbench';
import { JudgmentHistoryPanel } from './JudgmentHistoryPanel';
import { CorrectionGraph } from './CorrectionGraph';
import { SignalFeedPanel } from '../openclaw/SignalFeedPanel';
import { PushConfigDialog } from '../openclaw/PushConfigDialog';
import { Icon } from '../../components/ui/Icon';
import { useJudgmentStore } from '../../../application/stores/judgmentStore';

export function JudgmentPage() {
  const [showPushConfig, setShowPushConfig] = useState(false);
  const fetchFromBackend = useJudgmentStore((s) => s.fetchFromBackend);

  useEffect(() => {
    fetchFromBackend();
  }, [fetchFromBackend]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0d0d1a]">
      <div className="px-6 py-4 border-b border-white/10 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="psychology" size={20} className="text-primary" />
          <h1 className="text-base font-semibold text-slate-100">判断工作台</h1>
        </div>
        <button
          type="button"
          onClick={() => setShowPushConfig(true)}
          className="h-7 px-3 rounded-lg bg-white/[0.06] text-[11px] text-slate-300 hover:bg-white/[0.1] flex items-center gap-1"
        >
          <Icon name="tune" size={12} />
          推送设置
        </button>
      </div>

      <div className="flex-1 overflow-y-auto hmr-scrollbar p-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-[1400px] mx-auto">
          <SignalFeedPanel />
          <JudgmentHistoryPanel />
          <div className="xl:col-span-2">
            <JudgmentWorkbench />
          </div>
          <div className="xl:col-span-2">
            <CorrectionGraph />
          </div>
        </div>
      </div>

      <PushConfigDialog open={showPushConfig} onClose={() => setShowPushConfig(false)} />
    </div>
  );
}
