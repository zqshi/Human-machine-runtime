import { describe, it, expect } from 'vitest';
import { AgentCell, type AgentCellMember } from '../AgentCell';
import type { IntentDescriptor } from '../IntentProtocol';

const human: AgentCellMember = { id: 'h1', type: 'human', name: '张经理', role: 'manager' };
const agent: AgentCellMember = { id: 'a1', type: 'agent', name: 'Analyst', role: 'analyst' };
const cap: IntentDescriptor = {
  type: 'request_simulation',
  description: '模拟请求',
  requiredParams: ['scenario'],
  optionalParams: [],
  expectedOutputType: 'json',
  maxLatencyMs: 5000,
};

describe('AgentCell', () => {
  it('creates a cell with members and capabilities', () => {
    const cell = AgentCell.create({ name: '分析组', members: [human, agent], capabilities: [cap] });
    expect(cell.id).toMatch(/^cell-/);
    expect(cell.name).toBe('分析组');
    expect(cell.members).toHaveLength(2);
    expect(cell.capabilities).toHaveLength(1);
    expect(cell.activeSessionIds).toHaveLength(0);
  });

  it('adds and removes members immutably', () => {
    const cell = AgentCell.create({ name: 'test', members: [human] });
    const added = cell.addMember(agent);
    expect(added.members).toHaveLength(2);
    expect(cell.members).toHaveLength(1);

    const duplicate = added.addMember(agent);
    expect(duplicate).toBe(added);

    const removed = added.removeMember('a1');
    expect(removed.members).toHaveLength(1);
  });

  it('adds and removes capabilities', () => {
    const cell = AgentCell.create({ name: 'test', members: [human] });
    const withCap = cell.addCapability(cap);
    expect(withCap.canHandle('request_simulation')).toBe(true);

    const dup = withCap.addCapability(cap);
    expect(dup).toBe(withCap);

    const without = withCap.removeCapability('request_simulation');
    expect(without.canHandle('request_simulation')).toBe(false);
  });

  it('joins and leaves sessions', () => {
    const cell = AgentCell.create({ name: 'test', members: [human] });
    expect(cell.isActive).toBe(false);

    const joined = cell.joinSession('s1');
    expect(joined.isActive).toBe(true);
    expect(joined.activeSessionIds).toContain('s1');

    const dup = joined.joinSession('s1');
    expect(dup).toBe(joined);

    const left = joined.leaveSession('s1');
    expect(left.isActive).toBe(false);
  });

  it('filters human and agent members', () => {
    const cell = AgentCell.create({ name: 'test', members: [human, agent] });
    expect(cell.humanMembers).toHaveLength(1);
    expect(cell.agentMembers).toHaveLength(1);
    expect(cell.humanMembers[0].type).toBe('human');
  });

  it('defaults capabilities to empty', () => {
    const cell = AgentCell.create({ name: 'test', members: [] });
    expect(cell.capabilities).toHaveLength(0);
    expect(cell.canHandle('any')).toBe(false);
  });
});
