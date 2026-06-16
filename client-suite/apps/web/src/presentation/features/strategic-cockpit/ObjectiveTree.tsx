/**
 * ObjectiveTree — L0→L1→L2 目标对齐可视化树
 */
import { useState, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { useObjectiveStore } from '../../../application/stores/objectiveStore';
import type { ObjectiveDTO } from '../../../application/stores/objectiveStore';

interface TreeNode {
  id: string;
  level: 'L0' | 'L1' | 'L2';
  title: string;
  confidence: number;
  status: string;
  children: TreeNode[];
}

function buildTree(objectives: ObjectiveDTO[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  for (const o of objectives) {
    nodeMap.set(o.id, {
      id: o.id,
      level: o.level,
      title: o.title,
      confidence: o.confidence,
      status: o.status,
      children: [],
    });
  }
  const roots: TreeNode[] = [];
  for (const o of objectives) {
    const node = nodeMap.get(o.id)!;
    if (o.parentId && nodeMap.has(o.parentId)) {
      nodeMap.get(o.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

const LEVEL_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  L0: { bg: 'bg-primary/10', border: 'border-primary/30', text: 'text-primary' },
  L1: { bg: 'bg-purple-400/10', border: 'border-purple-400/30', text: 'text-purple-400' },
  L2: { bg: 'bg-blue-400/10', border: 'border-blue-400/30', text: 'text-blue-400' },
};

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? 'bg-green-400' : pct >= 50 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9px] text-slate-500">{pct}%</span>
    </div>
  );
}

function TreeNodeRow({ node, depth }: { node: TreeNode; depth: number }) {
  const [expanded, setExpanded] = useState(true);
  const colors = LEVEL_COLORS[node.level];
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${colors.bg} ${colors.border} hover:bg-white/[0.06]`}
        style={{ marginLeft: depth * 16 }}
      >
        <div className="flex items-center gap-2">
          {hasChildren && (
            <Icon
              name={expanded ? 'expand_more' : 'chevron_right'}
              size={12}
              className="text-slate-500"
            />
          )}
          <span className={`text-[9px] font-bold ${colors.text}`}>{node.level}</span>
          <span className="text-[11px] text-slate-200 truncate flex-1">{node.title}</span>
          <ConfidenceBar value={node.confidence} />
        </div>
      </button>
      {expanded && hasChildren && (
        <div className="mt-1 space-y-1">
          {node.children.map((child) => (
            <TreeNodeRow key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ObjectiveTree() {
  const { objectives, loading, fetch: fetchObjectives, subscribeSSE } = useObjectiveStore();

  useEffect(() => {
    fetchObjectives();
    subscribeSSE();
  }, [fetchObjectives, subscribeSSE]);

  const tree = buildTree(objectives);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="account_tree" size={16} className="text-primary/80" />
        <span className="text-sm font-medium text-slate-200">目标对齐树</span>
        <span className="text-[10px] text-slate-500">{objectives.length} 项</span>
      </div>
      {loading ? (
        <div className="text-center py-6 text-[11px] text-slate-500">加载中...</div>
      ) : tree.length === 0 ? (
        <div className="text-center py-6 text-[11px] text-slate-500">暂无目标数据</div>
      ) : (
        <div className="space-y-1.5">
          {tree.map((node) => (
            <TreeNodeRow key={node.id} node={node} depth={0} />
          ))}
        </div>
      )}
    </div>
  );
}
