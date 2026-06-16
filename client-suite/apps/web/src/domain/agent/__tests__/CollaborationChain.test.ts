import { describe, it, expect } from 'vitest';
import {
  CollaborationChain,
  type ChainNode,
  type ChainEdge,
  type CollaborationChainProps,
} from '../CollaborationChain';

const node1: ChainNode = {
  id: 'n1',
  agentId: 'agent-sec',
  agentName: '安全审计',
  agentCategory: 'security',
  taskSummary: '发现漏洞',
  status: 'completed',
  startedAt: 1000,
  completedAt: 2000,
};
const node2: ChainNode = {
  id: 'n2',
  agentId: 'agent-ops',
  agentName: '运维助手',
  agentCategory: 'ops',
  taskSummary: '隔离服务',
  status: 'active',
  startedAt: 2000,
};
const node3: ChainNode = {
  id: 'n3',
  agentId: 'agent-dev',
  agentName: '代码开发',
  agentCategory: 'dev',
  taskSummary: '生成修复 PR',
  status: 'pending',
  startedAt: 0,
};

const edges: ChainEdge[] = [
  { fromNodeId: 'n1', toNodeId: 'n2', label: '漏洞报告' },
  { fromNodeId: 'n2', toNodeId: 'n3', label: '隔离确认', dataPayload: 'task-123' },
];

const baseProps: CollaborationChainProps = {
  id: 'chain-1',
  name: '漏洞修复链',
  description: '端到端漏洞响应',
  nodes: [node1, node2, node3],
  edges,
  triggeredAt: 1000,
  status: 'running',
};

describe('CollaborationChain', () => {
  it('creates from props', () => {
    const chain = CollaborationChain.create(baseProps);
    expect(chain.id).toBe('chain-1');
    expect(chain.nodes).toHaveLength(3);
    expect(chain.edges).toHaveLength(2);
    expect(chain.status).toBe('running');
  });

  it('activeNode returns the active node', () => {
    const chain = CollaborationChain.create(baseProps);
    expect(chain.activeNode?.id).toBe('n2');
  });

  it('completedCount counts completed nodes', () => {
    const chain = CollaborationChain.create(baseProps);
    expect(chain.completedCount).toBe(1);
  });

  it('progress returns percentage', () => {
    const chain = CollaborationChain.create(baseProps);
    expect(chain.progress).toBe(33);
  });

  it('withNodeStatus updates node status', () => {
    const chain = CollaborationChain.create(baseProps);
    const updated = chain.withNodeStatus('n2', 'completed');
    expect(updated.nodes.find((n) => n.id === 'n2')?.status).toBe('completed');
    expect(updated.completedCount).toBe(2);
  });

  it('withNodeStatus sets completedAt on completion', () => {
    const chain = CollaborationChain.create(baseProps);
    const updated = chain.withNodeStatus('n2', 'completed');
    const n2 = updated.nodes.find((n) => n.id === 'n2');
    expect(n2?.completedAt).toBeGreaterThan(0);
  });

  it('withStatus changes chain status', () => {
    const chain = CollaborationChain.create(baseProps);
    const done = chain.withStatus('completed');
    expect(done.status).toBe('completed');
  });

  it('is immutable — original unchanged after withNodeStatus', () => {
    const chain = CollaborationChain.create(baseProps);
    chain.withNodeStatus('n2', 'completed');
    expect(chain.nodes.find((n) => n.id === 'n2')?.status).toBe('active');
  });

  it('activeNode returns undefined when none active', () => {
    const allDone = baseProps.nodes.map((n) => ({ ...n, status: 'completed' as const }));
    const chain = CollaborationChain.create({ ...baseProps, nodes: allDone });
    expect(chain.activeNode).toBeUndefined();
    expect(chain.progress).toBe(100);
  });
});
