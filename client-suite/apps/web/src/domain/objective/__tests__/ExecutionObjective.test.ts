import { describe, it, expect } from 'vitest';
import { ExecutionObjective } from '../ExecutionObjective';

describe('ExecutionObjective', () => {
  it('create generates pending with zero metrics', () => {
    const l2 = ExecutionObjective.create({
      l1Id: 'l1-1',
      taskContractId: 'tc-1',
      linkedAgentId: 'a-1',
      description: 'exec task',
    });
    expect(l2.id).toMatch(/^l2-/);
    expect(l2.status).toBe('pending');
    expect(l2.performanceMetrics.completionRate).toBe(0);
    expect(l2.isCompleted).toBe(false);
    expect(l2.isFailed).toBe(false);
  });

  it('fromProps preserves all fields', () => {
    const l2 = ExecutionObjective.fromProps({
      id: 'l2-1',
      l1Id: 'l1-1',
      taskContractId: 'tc-1',
      linkedAgentId: 'a-1',
      description: 'task',
      performanceMetrics: {
        completionRate: 0.5,
        acceptanceRate: 0.8,
        avgDurationMs: 1000,
        tokensCost: 50,
      },
      status: 'in-progress',
      createdAt: 1000,
      updatedAt: 2000,
    });
    expect(l2.performanceMetrics.completionRate).toBe(0.5);
    expect(l2.status).toBe('in-progress');
  });

  it('start transitions to in-progress', () => {
    const l2 = ExecutionObjective.create({
      l1Id: 'l1-1',
      taskContractId: 'tc-1',
      linkedAgentId: 'a-1',
      description: 'task',
    });
    const started = l2.start();
    expect(started.status).toBe('in-progress');
    expect(l2.status).toBe('pending');
  });

  it('complete sets status and merges metrics', () => {
    const l2 = ExecutionObjective.create({
      l1Id: 'l1-1',
      taskContractId: 'tc-1',
      linkedAgentId: 'a-1',
      description: 'task',
    }).start();
    const completed = l2.complete({ completionRate: 1, acceptanceRate: 0.95 });
    expect(completed.status).toBe('completed');
    expect(completed.isCompleted).toBe(true);
    expect(completed.performanceMetrics.completionRate).toBe(1);
    expect(completed.performanceMetrics.acceptanceRate).toBe(0.95);
  });

  it('fail sets status to failed', () => {
    const l2 = ExecutionObjective.create({
      l1Id: 'l1-1',
      taskContractId: 'tc-1',
      linkedAgentId: 'a-1',
      description: 'task',
    }).start();
    const failed = l2.fail();
    expect(failed.status).toBe('failed');
    expect(failed.isFailed).toBe(true);
  });

  it('updateMetrics merges without changing status', () => {
    const l2 = ExecutionObjective.create({
      l1Id: 'l1-1',
      taskContractId: 'tc-1',
      linkedAgentId: 'a-1',
      description: 'task',
    }).start();
    const updated = l2.updateMetrics({ tokensCost: 100 });
    expect(updated.performanceMetrics.tokensCost).toBe(100);
    expect(updated.status).toBe('in-progress');
  });

  it('all mutations are immutable', () => {
    const original = ExecutionObjective.create({
      l1Id: 'l1-1',
      taskContractId: 'tc-1',
      linkedAgentId: 'a-1',
      description: 'task',
    });
    const started = original.start();
    const completed = started.complete({ completionRate: 1 });
    expect(original.status).toBe('pending');
    expect(started.status).toBe('in-progress');
    expect(completed.status).toBe('completed');
  });
});
