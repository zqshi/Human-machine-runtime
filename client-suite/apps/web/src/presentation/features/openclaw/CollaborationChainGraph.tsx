/**
 * CollaborationChainGraph — 跨 Agent 协作链 SVG 可视化
 *
 * 水平排列 ChainNode，SVG 箭头线连接，节点状态色区分。
 * 手写 SVG，不引入第三方图库。
 */
import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import type { CollaborationChain, HandoffStatus } from '../../../domain/agent/CollaborationChain';

const STATUS_STYLE: Record<HandoffStatus, { fill: string; stroke: string; text: string; glow?: string }> = {
  completed: { fill: '#064e3b', stroke: '#34d399', text: 'text-green-400' },
  active: { fill: '#1e3a5f', stroke: '#60a5fa', text: 'text-blue-400', glow: 'drop-shadow(0 0 6px rgba(96,165,250,0.5))' },
  pending: { fill: '#1e293b', stroke: '#475569', text: 'text-slate-500' },
  failed: { fill: '#3b1414', stroke: '#f87171', text: 'text-red-400' },
};

const CATEGORY_ICON: Record<string, string> = {
  security: 'security',
  ops: 'engineering',
  dev: 'code',
  data: 'analytics',
  docs: 'description',
  test: 'science',
  design: 'palette',
  translate: 'translate',
};

const NODE_WIDTH = 120;
const NODE_HEIGHT = 60;
const GAP = 80;
const PADDING = 20;

interface CollaborationChainGraphProps {
  chain: CollaborationChain;
  compact?: boolean;
}

export function CollaborationChainGraph({ chain, compact = false }: CollaborationChainGraphProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const nodes = chain.nodes;
  const edges = chain.edges;

  const svgWidth = nodes.length * NODE_WIDTH + (nodes.length - 1) * GAP + PADDING * 2;
  const svgHeight = NODE_HEIGHT + PADDING * 2;

  const getNodeX = (idx: number) => PADDING + idx * (NODE_WIDTH + GAP);
  const _getNodeCenterX = (idx: number) => getNodeX(idx) + NODE_WIDTH / 2;
  const getNodeCenterY = () => PADDING + NODE_HEIGHT / 2;

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null;

  if (compact) {
    return <CompactChainView chain={chain} />;
  }

  return (
    <div className="space-y-3">
      {/* SVG Graph */}
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/20 p-2">
        <svg
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="min-w-full"
        >
          {/* Arrow marker definition */}
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#475569" />
            </marker>
            <marker id="arrowhead-active" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#60a5fa" />
            </marker>
          </defs>

          {/* Edges (arrows between nodes) */}
          {edges.map((edge) => {
            const fromIdx = nodes.findIndex((n) => n.id === edge.fromNodeId);
            const toIdx = nodes.findIndex((n) => n.id === edge.toNodeId);
            if (fromIdx < 0 || toIdx < 0) return null;

            const x1 = getNodeX(fromIdx) + NODE_WIDTH;
            const x2 = getNodeX(toIdx);
            const y = getNodeCenterY();
            const toNode = nodes[toIdx];
            const isActive = toNode.status === 'active';

            return (
              <g key={`${edge.fromNodeId}-${edge.toNodeId}`}>
                <line
                  x1={x1 + 4} y1={y} x2={x2 - 4} y2={y}
                  stroke={isActive ? '#60a5fa' : '#475569'}
                  strokeWidth={isActive ? 2 : 1.5}
                  strokeDasharray={isActive ? '6 3' : 'none'}
                  markerEnd={isActive ? 'url(#arrowhead-active)' : 'url(#arrowhead)'}
                />
                {/* Edge label */}
                <text
                  x={(x1 + x2) / 2}
                  y={y - 10}
                  textAnchor="middle"
                  className="text-[9px] fill-slate-500"
                >
                  {edge.label.length > 16 ? edge.label.slice(0, 16) + '…' : edge.label}
                </text>
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node, idx) => {
            const x = getNodeX(idx);
            const y = PADDING;
            const style = STATUS_STYLE[node.status];
            const isSelected = selectedNodeId === node.id;

            return (
              <g
                key={node.id}
                onClick={() => setSelectedNodeId(isSelected ? null : node.id)}
                className="cursor-pointer"
                style={style.glow ? { filter: style.glow } : undefined}
              >
                <rect
                  x={x} y={y}
                  width={NODE_WIDTH} height={NODE_HEIGHT}
                  rx={12}
                  fill={style.fill}
                  stroke={isSelected ? '#fff' : style.stroke}
                  strokeWidth={isSelected ? 2 : 1.5}
                />
                {/* Agent name */}
                <text
                  x={x + NODE_WIDTH / 2} y={y + 25}
                  textAnchor="middle"
                  className="text-[11px] font-medium"
                  fill={node.status === 'pending' ? '#94a3b8' : '#e2e8f0'}
                >
                  {node.agentName}
                </text>
                {/* Status indicator */}
                <text
                  x={x + NODE_WIDTH / 2} y={y + 42}
                  textAnchor="middle"
                  className="text-[9px]"
                  fill={style.stroke}
                >
                  {node.status === 'completed' ? '✓ 完成' : node.status === 'active' ? '● 执行中' : node.status === 'failed' ? '✗ 失败' : '○ 等待'}
                </text>
                {/* Pulse animation for active node */}
                {node.status === 'active' && (
                  <rect
                    x={x} y={y}
                    width={NODE_WIDTH} height={NODE_HEIGHT}
                    rx={12}
                    fill="none"
                    stroke="#60a5fa"
                    strokeWidth={1}
                    opacity={0.5}
                  >
                    <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="stroke-width" values="1;3;1" dur="2s" repeatCount="indefinite" />
                  </rect>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected node detail */}
      {selectedNode && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2 animate-[fadeIn_0.15s_ease-out]">
          <div className="flex items-center gap-2">
            <Icon name={CATEGORY_ICON[selectedNode.agentCategory] ?? 'smart_toy'} size={16} className={STATUS_STYLE[selectedNode.status].text} />
            <span className="text-sm font-medium text-slate-100">{selectedNode.agentName}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_STYLE[selectedNode.status].text} bg-white/[0.06]`}>
              {selectedNode.agentCategory}
            </span>
          </div>
          <p className="text-xs text-slate-300">{selectedNode.taskSummary}</p>
          {selectedNode.outputSummary && (
            <div className="rounded-lg bg-white/[0.04] p-2">
              <p className="text-[10px] text-slate-500 mb-0.5">输出</p>
              <p className="text-xs text-slate-300">{selectedNode.outputSummary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Compact inline view for WelcomePage */
function CompactChainView({ chain }: { chain: CollaborationChain }) {
  const activeNode = chain.activeNode;
  return (
    <div className="flex items-center gap-2">
      {chain.nodes.map((node, idx) => (
        <div key={node.id} className="flex items-center gap-1.5">
          <div className={`w-6 h-6 rounded-md flex items-center justify-center ${
            node.status === 'completed' ? 'bg-green-500/20' :
            node.status === 'active' ? 'bg-blue-500/20' : 'bg-slate-500/20'
          }`}>
            <Icon
              name={CATEGORY_ICON[node.agentCategory] ?? 'smart_toy'}
              size={14}
              className={STATUS_STYLE[node.status].text}
            />
          </div>
          {idx < chain.nodes.length - 1 && (
            <Icon name="arrow_forward" size={12} className="text-slate-600" />
          )}
        </div>
      ))}
      {activeNode && (
        <span className="text-[10px] text-blue-400 ml-1">{activeNode.agentName} 处理中</span>
      )}
    </div>
  );
}
