import { describe, it, expect } from 'vitest';
import { AgentPerformanceTracker } from '../AgentPerformanceTracker';
import { AgentCapabilityProfile } from '../AgentCapabilityProfile';
import { TaskContract } from '../TaskContract';

describe('AgentPerformanceTracker', () => {
  it('creates empty tracker', () => {
    const tracker = AgentPerformanceTracker.create();
    expect(tracker.getAllProfiles()).toHaveLength(0);
  });

  it('records completion and creates profile', () => {
    const tracker = AgentPerformanceTracker.create();
    const profile = tracker.recordCompletion({
      taskId: 't1',
      contractId: 'c1',
      agentId: 'a1',
      outcome: 'success',
      durationMs: 1000,
      tokenCost: 500,
      domain: 'dev',
      completedAt: Date.now(),
    });
    expect(profile.totalTasks).toBe(1);
    expect(profile.overallSuccessRate).toBe(1);
  });

  it('tracks failures correctly', () => {
    const tracker = AgentPerformanceTracker.create();
    tracker.recordCompletion({
      taskId: 't1',
      contractId: 'c1',
      agentId: 'a1',
      outcome: 'success',
      durationMs: 1000,
      tokenCost: 500,
      domain: 'dev',
      completedAt: Date.now(),
    });
    tracker.recordCompletion({
      taskId: 't2',
      contractId: 'c2',
      agentId: 'a1',
      outcome: 'failure',
      durationMs: 2000,
      tokenCost: 300,
      domain: 'dev',
      completedAt: Date.now(),
    });
    const profile = tracker.getProfile('a1')!;
    expect(profile.totalTasks).toBe(2);
    expect(profile.overallSuccessRate).toBe(0.5);
  });

  it('records from contract', () => {
    const tracker = AgentPerformanceTracker.create();
    const contract = TaskContract.create({
      objective: 'test',
      inputs: [],
      acceptanceCriteria: [],
      constraints: [],
      escalationConditions: [],
      estimatedCostTokens: 1000,
      estimatedDurationMs: 5000,
      publishedIntents: ['testing'],
    });
    const profile = tracker.recordFromContract('a1', contract, 'success', 3000, 800);
    expect(profile.getDomain('testing')).toBeDefined();
    expect(profile.getDomain('testing')!.successRate).toBe(1);
  });

  it('getTopPerformers sorts by domain success rate', () => {
    const tracker = AgentPerformanceTracker.create();
    tracker.recordCompletion({
      taskId: 't1',
      contractId: 'c1',
      agentId: 'a1',
      outcome: 'success',
      durationMs: 1000,
      tokenCost: 500,
      domain: 'dev',
      completedAt: Date.now(),
    });
    tracker.recordCompletion({
      taskId: 't2',
      contractId: 'c2',
      agentId: 'a2',
      outcome: 'failure',
      durationMs: 1000,
      tokenCost: 500,
      domain: 'dev',
      completedAt: Date.now(),
    });
    const top = tracker.getTopPerformers('dev');
    expect(top[0].agentId).toBe('a1');
  });

  it('fromProfiles initializes with existing profiles', () => {
    const p = AgentCapabilityProfile.create({ agentId: 'a1', name: 'Agent 1' });
    const tracker = AgentPerformanceTracker.fromProfiles([p]);
    expect(tracker.getProfile('a1')).toBeDefined();
  });
});
