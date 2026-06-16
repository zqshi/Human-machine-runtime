import { describe, it, expect } from 'vitest';
import { AgentRuntime } from '../AgentRuntime';

const baseProps = {
  agentId: 'agent-1',
  runtimeStatus: 'idle' as const,
  currentTaskId: null,
  tokenUsage: 0,
  lastActiveAt: 1000,
  connectedChannels: [],
};

describe('AgentRuntime', () => {
  it('creates from props', () => {
    const rt = AgentRuntime.create(baseProps);
    expect(rt.agentId).toBe('agent-1');
    expect(rt.runtimeStatus).toBe('idle');
    expect(rt.isActive).toBe(false);
    expect(rt.pendingDecisionIds).toEqual([]);
  });

  it('isActive true for working status', () => {
    const rt = AgentRuntime.create({ ...baseProps, runtimeStatus: 'working' });
    expect(rt.isActive).toBe(true);
  });

  it('isActive true for monitoring status', () => {
    const rt = AgentRuntime.create({ ...baseProps, runtimeStatus: 'monitoring' });
    expect(rt.isActive).toBe(true);
  });

  it('withStatus changes runtime status', () => {
    const rt = AgentRuntime.create(baseProps);
    const updated = rt.withStatus('working');
    expect(updated.runtimeStatus).toBe('working');
    expect(updated.isActive).toBe(true);
    expect(rt.runtimeStatus).toBe('idle');
  });

  it('withTokenUsage adds delta', () => {
    const rt = AgentRuntime.create({ ...baseProps, tokenUsage: 100 });
    const updated = rt.withTokenUsage(50);
    expect(updated.tokenUsage).toBe(150);
    expect(rt.tokenUsage).toBe(100);
  });

  it('withTask sets task and working status', () => {
    const rt = AgentRuntime.create(baseProps);
    const updated = rt.withTask('task-1');
    expect(updated.currentTaskId).toBe('task-1');
    expect(updated.runtimeStatus).toBe('working');
  });

  it('withTask null clears task and sets idle', () => {
    const rt = AgentRuntime.create({
      ...baseProps,
      currentTaskId: 'task-1',
      runtimeStatus: 'working',
    });
    const updated = rt.withTask(null);
    expect(updated.currentTaskId).toBeNull();
    expect(updated.runtimeStatus).toBe('idle');
  });

  it('preserves pendingDecisionIds', () => {
    const rt = AgentRuntime.create({ ...baseProps, pendingDecisionIds: ['d1', 'd2'] });
    expect(rt.pendingDecisionIds).toEqual(['d1', 'd2']);
  });
});
