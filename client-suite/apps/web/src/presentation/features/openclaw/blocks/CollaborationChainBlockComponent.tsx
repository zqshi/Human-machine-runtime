/**
 * CollaborationChainBlockComponent — 聊天消息中的协作链紧凑卡片
 * 点击打开 Drawer 查看完整 SVG 协作图。
 */
import { useOpenClawStore } from '../../../../application/stores/openclawStore';
import type { OpenClawDrawerContent } from '../../../../domain/agent/DrawerContent';
import { Icon } from '../../../components/ui/Icon';

interface Props {
  chainId: string;
  chainName: string;
  nodeCount: number;
  activeNodeName?: string;
  onOpen: (content: OpenClawDrawerContent) => void;
}

export function CollaborationChainBlockComponent({ chainId, chainName, nodeCount, activeNodeName, onOpen }: Props) {
  const chains = useOpenClawStore((s) => s.collaborationChains);
  const chain = chains.find((c) => c.id === chainId);
  const progress = chain?.progress ?? 0;

  return (
    <button
      type="button"
      onClick={() => onOpen({ type: 'collaboration-chain', title: chainName, data: { chainId } })}
      className="w-full p-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-left"
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon name="account_tree" size={16} className="text-primary" />
        <span className="text-xs font-medium text-slate-100">{chainName}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400">
          {nodeCount} 节点
        </span>
      </div>
      {/* Progress bar */}
      <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-green-400 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      {activeNodeName && (
        <p className="text-[10px] text-blue-400 mt-1.5 flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" />
          {activeNodeName} 处理中
        </p>
      )}
      <p className="text-[10px] text-primary/60 mt-1 flex items-center gap-0.5 justify-end">
        查看详情 <Icon name="chevron_right" size={12} />
      </p>
    </button>
  );
}
