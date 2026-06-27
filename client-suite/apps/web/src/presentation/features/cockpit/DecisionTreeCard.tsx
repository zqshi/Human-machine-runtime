/**
 * DecisionTreeCard — 因果决策树展开卡片
 *
 * 嵌在 WelcomePage 的 activity 行下方，展示 trigger → reasoning → action → outcome 链。
 * 视觉风格复用 CoT Steps 的竖线连接器。
 */
import { Icon } from '../../components/ui/Icon';
import type { DecisionTree } from '../../../domain/agent/DecisionTree';
import type { DecisionNodeType, DecisionNodeStatus } from '../../../domain/agent/DecisionTree';

const NODE_TYPE_CONFIG: Record<DecisionNodeType, { icon: string; label: string }> = {
  trigger: { icon: 'bolt', label: '触发' },
  reasoning: { icon: 'psychology', label: '推理' },
  action: { icon: 'play_circle', label: '执行' },
  outcome: { icon: 'flag', label: '结果' },
};

const NODE_STATUS_STYLE: Record<DecisionNodeStatus, { color: string; ring: string }> = {
  completed: { color: 'text-green-400', ring: 'border-green-400/30 bg-green-400/10' },
  active: { color: 'text-blue-400', ring: 'border-blue-400/30 bg-blue-400/10' },
  pending: { color: 'text-slate-500', ring: 'border-slate-500/30 bg-slate-500/10' },
};

const ACTION_TYPE_STYLE: Record<string, string> = {
  approve: 'border-green-500/30 text-green-400 hover:bg-green-500/10',
  reject: 'border-red-500/30 text-red-400 hover:bg-red-500/10',
  modify: 'border-blue-500/30 text-blue-400 hover:bg-blue-500/10',
  escalate: 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10',
  dismiss: 'border-slate-500/30 text-slate-400 hover:bg-slate-500/10',
};

interface DecisionTreeCardProps {
  tree: DecisionTree;
  onFollowUp: (actionId: string) => void;
}

export function DecisionTreeCard({ tree, onFollowUp }: DecisionTreeCardProps) {
  return (
    <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-4 animate-[fadeIn_0.2s_ease-out]">
      {/* Confidence badge */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-500">决策链路</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500">置信度</span>
          <span className={`text-xs font-semibold ${
            tree.confidence >= 90 ? 'text-green-400' : tree.confidence >= 70 ? 'text-blue-400' : 'text-yellow-400'
          }`}>
            {tree.confidence}%
          </span>
        </div>
      </div>

      {/* Decision chain — vertical timeline */}
      <div className="relative">
        {tree.nodes.map((node, idx) => {
          const typeConfig = NODE_TYPE_CONFIG[node.type];
          const statusStyle = NODE_STATUS_STYLE[node.status];
          const isLast = idx === tree.nodes.length - 1;

          return (
            <div key={node.id} className="flex items-start gap-3 relative">
              {/* Vertical connector line */}
              {!isLast && (
                <div className="absolute left-[15px] top-[32px] w-px h-[calc(100%-8px)] bg-white/10" />
              )}

              {/* Node icon */}
              <div className={`w-[30px] h-[30px] rounded-lg border ${statusStyle.ring} flex items-center justify-center shrink-0 relative z-10`}>
                <Icon name={typeConfig.icon} size={16} className={statusStyle.color} />
              </div>

              {/* Node content */}
              <div className="min-w-0 flex-1 pb-4">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${statusStyle.color}`}>{node.label}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-500">{typeConfig.label}</span>
                  {node.status === 'active' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{node.detail}</p>

                {/* Metadata badges */}
                {node.metadata && Object.keys(node.metadata).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {Object.entries(node.metadata).map(([key, value]) => (
                      <span key={key} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-500">
                        {key}: {value}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Follow-up actions */}
      {tree.followUpActions.length > 0 && (
        <div className="border-t border-white/5 pt-3">
          <p className="text-[10px] text-slate-500 mb-2">可执行操作</p>
          <div className="flex flex-wrap gap-2">
            {tree.followUpActions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => onFollowUp(action.id)}
                className={`h-7 px-3 rounded-lg border text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
                  ACTION_TYPE_STYLE[action.actionType] ?? ACTION_TYPE_STYLE.dismiss
                }`}
              >
                <Icon name={action.icon} size={13} />
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
