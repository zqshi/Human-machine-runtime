import { describe, it, expect } from 'vitest';
import { AgentCapabilityProfile } from '../AgentCapabilityProfile';

describe('AgentCapabilityProfile', () => {
  it('creates with defaults', () => {
    const p = AgentCapabilityProfile.create({ agentId: 'a1', name: 'Bot' });
    expect(p.agentId).toBe('a1');
    expect(p.name).toBe('Bot');
    expect(p.domains).toHaveLength(0);
    expect(p.overallSuccessRate).toBe(0);
    expect(p.totalTasksCompleted).toBe(0);
    expect(p.totalTasksFailed).toBe(0);
    expect(p.totalTasks).toBe(0);
    expect(p.costPerTask).toBe(0);
  });

  it('round-trips via fromProps', () => {
    const p = AgentCapabilityProfile.create({ agentId: 'a1', name: 'Bot' });
    const p2 = AgentCapabilityProfile.fromProps({
      agentId: p.agentId,
      name: p.name,
      domains: [...p.domains],
      overallSuccessRate: p.overallSuccessRate,
      totalTasksCompleted: p.totalTasksCompleted,
      totalTasksFailed: p.totalTasksFailed,
      avgResponseMs: p.avgResponseMs,
      totalTokensConsumed: p.totalTokensConsumed,
      lastActiveAt: p.lastActiveAt,
      createdAt: p.createdAt,
    });
    expect(p2.agentId).toBe('a1');
    expect(p2.domains).toHaveLength(0);
  });

  it('recordSuccess adds new domain', () => {
    const p = AgentCapabilityProfile.create({ agentId: 'a1', name: 'Bot' });
    const p2 = p.recordSuccess('coding', 500, 100);
    expect(p2.totalTasksCompleted).toBe(1);
    expect(p2.overallSuccessRate).toBe(1);
    expect(p2.totalTokensConsumed).toBe(100);
    const d = p2.getDomain('coding');
    expect(d).toBeDefined();
    expect(d!.successRate).toBe(1);
    expect(d!.totalExecutions).toBe(1);
    expect(d!.avgDurationMs).toBe(500);
    expect(d!.avgTokenCost).toBe(100);
  });

  it('recordFailure tracks failed tasks', () => {
    const p = AgentCapabilityProfile.create({ agentId: 'a1', name: 'Bot' });
    const p2 = p.recordFailure('coding', 200, 50);
    expect(p2.totalTasksFailed).toBe(1);
    expect(p2.totalTasksCompleted).toBe(0);
    expect(p2.overallSuccessRate).toBe(0);
    expect(p2.totalTokensConsumed).toBe(50);
    const d = p2.getDomain('coding');
    expect(d!.successRate).toBe(0);
  });

  it('computes overall success rate after mixed results', () => {
    let p = AgentCapabilityProfile.create({ agentId: 'a1', name: 'Bot' });
    p = p.recordSuccess('coding', 500, 100);
    p = p.recordSuccess('coding', 600, 120);
    p = p.recordFailure('coding', 300, 80);
    expect(p.totalTasksCompleted).toBe(2);
    expect(p.totalTasksFailed).toBe(1);
    expect(p.totalTasks).toBe(3);
    expect(p.overallSuccessRate).toBeCloseTo(2 / 3, 5);
  });

  it('updates existing domain stats', () => {
    let p = AgentCapabilityProfile.create({ agentId: 'a1', name: 'Bot' });
    p = p.recordSuccess('coding', 500, 100);
    p = p.recordSuccess('coding', 700, 200);
    const d = p.getDomain('coding')!;
    expect(d.totalExecutions).toBe(2);
    expect(d.successRate).toBe(1);
    expect(d.avgDurationMs).toBe(600);
    expect(d.avgTokenCost).toBe(150);
  });

  it('tracks multiple domains independently', () => {
    let p = AgentCapabilityProfile.create({ agentId: 'a1', name: 'Bot' });
    p = p.recordSuccess('coding', 500, 100);
    p = p.recordFailure('writing', 200, 50);
    expect(p.domains).toHaveLength(2);
    expect(p.getDomain('coding')!.successRate).toBe(1);
    expect(p.getDomain('writing')!.successRate).toBe(0);
  });

  it('costPerTask computes correctly', () => {
    let p = AgentCapabilityProfile.create({ agentId: 'a1', name: 'Bot' });
    p = p.recordSuccess('coding', 500, 100);
    p = p.recordSuccess('coding', 600, 200);
    expect(p.costPerTask).toBe(150);
  });

  it('getDomain returns undefined for unknown domain', () => {
    const p = AgentCapabilityProfile.create({ agentId: 'a1', name: 'Bot' });
    expect(p.getDomain('unknown')).toBeUndefined();
  });

  it('is immutable — original unchanged after recordSuccess', () => {
    const p = AgentCapabilityProfile.create({ agentId: 'a1', name: 'Bot' });
    const p2 = p.recordSuccess('coding', 500, 100);
    expect(p.totalTasksCompleted).toBe(0);
    expect(p2.totalTasksCompleted).toBe(1);
    expect(p.domains).toHaveLength(0);
  });
});
