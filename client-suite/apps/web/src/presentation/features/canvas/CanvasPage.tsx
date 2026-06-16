import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';

interface CanvasNode {
  id: string;
  type: 'agent' | 'decision' | 'task' | 'signal' | 'channel';
  label: string;
  x: number;
  y: number;
  status: 'active' | 'idle' | 'error';
}

interface CanvasConnection {
  from: string;
  to: string;
  label?: string;
}

const INITIAL_NODES: CanvasNode[] = [
  { id: 'ch-1', type: 'channel', label: 'WPS 渠道', x: 50, y: 150, status: 'active' },
  { id: 'ch-2', type: 'channel', label: 'Matrix 渠道', x: 50, y: 300, status: 'active' },
  { id: 'sig-1', type: 'signal', label: '信号分拣', x: 250, y: 225, status: 'active' },
  { id: 'dec-1', type: 'decision', label: '决策引擎', x: 450, y: 225, status: 'idle' },
  { id: 'agt-1', type: 'agent', label: '执行 Agent', x: 650, y: 150, status: 'idle' },
  { id: 'agt-2', type: 'agent', label: '分析 Agent', x: 650, y: 300, status: 'idle' },
];

const INITIAL_CONNECTIONS: CanvasConnection[] = [
  { from: 'ch-1', to: 'sig-1', label: '消息流' },
  { from: 'ch-2', to: 'sig-1', label: '消息流' },
  { from: 'sig-1', to: 'dec-1', label: '高优信号' },
  { from: 'dec-1', to: 'agt-1', label: '派发任务' },
  { from: 'dec-1', to: 'agt-2', label: '派发任务' },
];

const NODE_STYLES: Record<string, { bg: string; border: string; icon: string }> = {
  agent: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', icon: 'smart_toy' },
  decision: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', icon: 'psychology' },
  task: { bg: 'bg-green-500/10', border: 'border-green-500/30', icon: 'task_alt' },
  signal: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', icon: 'radar' },
  channel: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', icon: 'forum' },
};

export function CanvasPage() {
  const [nodes] = useState<CanvasNode[]>(INITIAL_NODES);
  const [connections] = useState<CanvasConnection[]>(INITIAL_CONNECTIONS);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0d0d1a]">
      <div className="px-6 py-4 border-b border-white/10 shrink-0 flex items-center gap-2">
        <Icon name="draw" size={20} className="text-primary" />
        <h1 className="text-base font-semibold text-slate-100">运行时画布</h1>
        <span className="ml-auto text-xs text-slate-500">
          {nodes.length} 节点 · {connections.length} 连接
        </span>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {connections.map((conn) => {
            const from = nodes.find((n) => n.id === conn.from);
            const to = nodes.find((n) => n.id === conn.to);
            if (!from || !to) return null;
            return (
              <g key={`${conn.from}-${conn.to}`}>
                <line
                  x1={from.x + 70}
                  y1={from.y + 25}
                  x2={to.x}
                  y2={to.y + 25}
                  stroke="rgba(100,116,139,0.3)"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                />
                {conn.label && (
                  <text
                    x={(from.x + 70 + to.x) / 2}
                    y={(from.y + to.y) / 2 + 20}
                    fill="rgba(148,163,184,0.6)"
                    fontSize={10}
                    textAnchor="middle"
                  >
                    {conn.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {nodes.map((node) => {
          const style = NODE_STYLES[node.type] ?? NODE_STYLES.task!;
          return (
            <button
              key={node.id}
              onClick={() => setSelectedNode(node.id === selectedNode ? null : node.id)}
              style={{ left: node.x, top: node.y }}
              className={`absolute w-[140px] rounded-lg border p-3 transition-all cursor-pointer ${
                style.bg
              } ${style.border} ${
                selectedNode === node.id ? 'ring-2 ring-primary/50 scale-105' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon name={style.icon} size={14} className="text-slate-300" />
                <span className="text-xs text-slate-200 truncate">{node.label}</span>
              </div>
              <div className="flex items-center gap-1 mt-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    node.status === 'active'
                      ? 'bg-green-400 animate-pulse'
                      : node.status === 'error'
                        ? 'bg-red-400'
                        : 'bg-slate-500'
                  }`}
                />
                <span className="text-[10px] text-slate-500">
                  {node.status === 'active' ? '运行中' : node.status === 'error' ? '异常' : '空闲'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
