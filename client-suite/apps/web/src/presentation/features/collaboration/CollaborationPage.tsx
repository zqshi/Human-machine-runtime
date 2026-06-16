import { CollaborationTopology } from './CollaborationTopology';
import { Icon } from '../../components/ui/Icon';

export function CollaborationPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0d0d1a]">
      <div className="px-6 py-4 border-b border-white/10 shrink-0 flex items-center gap-2">
        <Icon name="hub" size={20} className="text-primary" />
        <h1 className="text-base font-semibold text-slate-100">Agent 协作网络</h1>
        <span className="ml-auto text-xs text-slate-500">实时拓扑</span>
      </div>

      <div className="flex-1 overflow-y-auto hmr-scrollbar p-6">
        <CollaborationTopology />
      </div>
    </div>
  );
}
