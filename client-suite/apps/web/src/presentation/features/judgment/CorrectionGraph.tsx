/**
 * CorrectionGraph — 纠偏影响范围 DAG 可视化
 *
 * 以 DAG 形式展示 CorrectionPlan 中的传播关系：
 * Decision(根节点) → Tasks/Goals/ChainNodes(叶子节点)
 * 每个节点显示实体名称 + 建议动作（颜色编码）。
 */
import { useMemo } from 'react';
import { useOpenClawStore } from '../../../application/stores/openclawStore';
import type { CorrectionPlan, CorrectionAction } from '../../../domain/agent/CorrectionPropagator';
import { Icon } from '../../components/ui/Icon';

const ACTION_META: Record<
  CorrectionAction,
  { label: string; color: string; bgColor: string; icon: string }
> = {
  continue: {
    label: '继续',
    color: 'text-green-400',
    bgColor: 'bg-green-400/10 border-green-400/20',
    icon: 'play_arrow',
  },
  're-evaluate': {
    label: '重新评估',
    color: 'text-orange-400',
    bgColor: 'bg-orange-400/10 border-orange-400/20',
    icon: 'refresh',
  },
  pause: {
    label: '暂停',
    color: 'text-red-400',
    bgColor: 'bg-red-400/10 border-red-400/20',
    icon: 'pause',
  },
};

interface GraphNode {
  id: string;
  type: 'decision' | 'task' | 'goal' | 'chain';
  label: string;
  action?: CorrectionAction;
}

interface GraphEdge {
  from: string;
  to: string;
}

function buildGraph(plan: CorrectionPlan): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const rootId = `decision-${plan.decisionId}`;
  const nodes: GraphNode[] = [
    { id: rootId, type: 'decision', label: `决策 ${plan.decisionId.slice(0, 8)}` },
  ];
  const edges: GraphEdge[] = [];

  for (const t of plan.affectedTasks) {
    const nodeId = `task-${t.taskId}`;
    nodes.push({ id: nodeId, type: 'task', label: t.taskName, action: t.suggestedAction });
    edges.push({ from: rootId, to: nodeId });
  }

  for (const g of plan.affectedGoals) {
    const nodeId = `goal-${g.goalId}`;
    nodes.push({ id: nodeId, type: 'goal', label: g.goalTitle, action: g.suggestedAction });
    edges.push({ from: rootId, to: nodeId });
  }

  for (const c of plan.affectedChainNodes) {
    const nodeId = `chain-${c.chainId}-${c.nodeId}`;
    nodes.push({ id: nodeId, type: 'chain', label: c.chainName, action: c.suggestedAction });
    edges.push({ from: rootId, to: nodeId });
  }

  return { nodes, edges };
}

const TYPE_ICON: Record<string, { name: string; color: string }> = {
  decision: { name: 'bolt', color: 'text-primary' },
  task: { name: 'pending_actions', color: 'text-blue-400' },
  goal: { name: 'flag', color: 'text-yellow-400' },
  chain: { name: 'link', color: 'text-purple-400' },
};

function GraphNodeCard({ node }: { node: GraphNode }) {
  const typeIcon = TYPE_ICON[node.type];
  const actionMeta = node.action ? ACTION_META[node.action] : null;

  return (
    <div
      className={`rounded-lg border px-3 py-2 min-w-[140px] ${
        actionMeta ? actionMeta.bgColor : 'bg-primary/10 border-primary/20'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <Icon name={typeIcon.name} size={13} className={typeIcon.color} />
        <span className="text-[11px] text-slate-300 truncate flex-1">{node.label}</span>
      </div>
      {actionMeta && (
        <div className="flex items-center gap-1 mt-1 pl-5">
          <Icon name={actionMeta.icon} size={11} className={actionMeta.color} />
          <span className={`text-[10px] ${actionMeta.color}`}>{actionMeta.label}</span>
        </div>
      )}
    </div>
  );
}

interface CorrectionGraphProps {
  plan?: CorrectionPlan | null;
}

export function CorrectionGraph({ plan: propPlan }: CorrectionGraphProps) {
  const storePlan = useOpenClawStore((s) => s.lastCorrectionPlan);
  const plan = propPlan ?? storePlan;

  const graph = useMemo(() => {
    if (!plan) return null;
    return buildGraph(plan);
  }, [plan]);

  if (!graph || graph.nodes.length <= 1) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon name="account_tree" size={16} className="text-primary/80" />
          <span className="text-sm font-medium text-slate-200">纠偏传播图</span>
        </div>
        <div className="flex items-center justify-center py-6 text-slate-500 text-xs">
          暂无纠偏传播记录
        </div>
      </div>
    );
  }

  const rootNode = graph.nodes[0];
  const childNodes = graph.nodes.slice(1);

  const taskNodes = childNodes.filter((n) => n.type === 'task');
  const goalNodes = childNodes.filter((n) => n.type === 'goal');
  const chainNodes = childNodes.filter((n) => n.type === 'chain');

  const stats = {
    total: childNodes.length,
    paused: childNodes.filter((n) => n.action === 'pause').length,
    reeval: childNodes.filter((n) => n.action === 're-evaluate').length,
    continued: childNodes.filter((n) => n.action === 'continue').length,
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Icon name="account_tree" size={16} className="text-primary/80" />
        <span className="text-sm font-medium text-slate-200">纠偏传播图</span>
        <span className="text-[10px] text-slate-500">影响 {stats.total} 个实体</span>
        {stats.paused > 0 && <span className="text-[10px] text-red-400">{stats.paused} 暂停</span>}
        {stats.reeval > 0 && (
          <span className="text-[10px] text-orange-400">{stats.reeval} 重评</span>
        )}
      </div>

      {/* DAG visualization — simplified layered layout */}
      <div className="flex flex-col items-center gap-3">
        {/* Root */}
        <GraphNodeCard node={rootNode} />

        {/* Edges indicator */}
        {childNodes.length > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-px h-4 bg-white/20" />
            <Icon name="arrow_downward" size={12} className="text-slate-500" />
            <div className="w-px h-4 bg-white/20" />
          </div>
        )}

        {/* Children grouped by type */}
        <div className="w-full space-y-2">
          {taskNodes.length > 0 && (
            <div>
              <div className="flex items-center gap-1 mb-1 px-1">
                <Icon name="pending_actions" size={11} className="text-blue-400/60" />
                <span className="text-[9px] text-slate-500">任务 ({taskNodes.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {taskNodes.map((node) => (
                  <GraphNodeCard key={node.id} node={node} />
                ))}
              </div>
            </div>
          )}

          {goalNodes.length > 0 && (
            <div>
              <div className="flex items-center gap-1 mb-1 px-1">
                <Icon name="flag" size={11} className="text-yellow-400/60" />
                <span className="text-[9px] text-slate-500">目标 ({goalNodes.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {goalNodes.map((node) => (
                  <GraphNodeCard key={node.id} node={node} />
                ))}
              </div>
            </div>
          )}

          {chainNodes.length > 0 && (
            <div>
              <div className="flex items-center gap-1 mb-1 px-1">
                <Icon name="link" size={11} className="text-purple-400/60" />
                <span className="text-[9px] text-slate-500">协作链 ({chainNodes.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {chainNodes.map((node) => (
                  <GraphNodeCard key={node.id} node={node} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
