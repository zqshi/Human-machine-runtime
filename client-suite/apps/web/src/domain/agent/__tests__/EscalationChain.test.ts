import { describe, it, expect } from 'vitest';
import { EscalationChain, type StageConfig } from '../EscalationChain';

describe('EscalationChain', () => {
  it('createDefault produces idle chain with 4 stages', () => {
    const chain = EscalationChain.createDefault('task-001');
    expect(chain.status).toBe('idle');
    expect(chain.stages).toHaveLength(4);
    expect(chain.currentStageIndex).toBe(0);
    expect(chain.taskId).toBe('task-001');
  });

  it('trigger transitions from idle to active', () => {
    const chain = EscalationChain.createDefault('task-001').trigger();
    expect(chain.status).toBe('active');
  });

  it('trigger on non-idle is a no-op', () => {
    const chain = EscalationChain.createDefault('task-001').trigger().trigger();
    expect(chain.status).toBe('active');
  });

  it('recordAttempt success resolves the chain', () => {
    const chain = EscalationChain.createDefault('task-001').trigger().recordAttempt(true);
    expect(chain.status).toBe('resolved');
    expect(chain.resolvedAt).toBeDefined();
    expect(chain.totalAttempts).toBe(1);
  });

  it('recordAttempt failure retries within same stage', () => {
    const chain = EscalationChain.createDefault('task-001').trigger().recordAttempt(false);
    expect(chain.status).toBe('active');
    expect(chain.currentStageIndex).toBe(0);
    expect(chain.currentAttempt).toBe(1);
  });

  it('exhausting maxAttempts moves to next stage', () => {
    let chain = EscalationChain.createDefault('task-001').trigger();
    chain = chain.recordAttempt(false);
    chain = chain.recordAttempt(false);
    chain = chain.recordAttempt(false);
    expect(chain.currentStageIndex).toBe(1);
    expect(chain.currentAttempt).toBe(0);
  });

  it('exhausting all stages escalates to human', () => {
    const stages: StageConfig[] = [
      { stage: 'retry', maxAttempts: 1, timeoutMs: 1000 },
      { stage: 'escalate-human', maxAttempts: 1, timeoutMs: 1000 },
    ];
    let chain = EscalationChain.create('task-002', stages).trigger();
    chain = chain.recordAttempt(false);
    chain = chain.recordAttempt(false);
    expect(chain.status).toBe('escalated-to-human');
    expect(chain.isEscalatedToHuman).toBe(true);
  });

  it('resolve manually resolves the chain', () => {
    const chain = EscalationChain.createDefault('task-001').trigger().resolve('Fixed manually');
    expect(chain.status).toBe('resolved');
    expect(chain.resolution).toBe('Fixed manually');
  });

  it('progressPercent reflects stage progress', () => {
    const stages: StageConfig[] = [
      { stage: 'retry', maxAttempts: 1, timeoutMs: 1000 },
      { stage: 'degrade', maxAttempts: 1, timeoutMs: 1000 },
      { stage: 'swap-agent', maxAttempts: 1, timeoutMs: 1000 },
      { stage: 'escalate-human', maxAttempts: 1, timeoutMs: 1000 },
    ];
    let chain = EscalationChain.create('task-003', stages).trigger();
    expect(chain.progressPercent).toBe(0);
    chain = chain.recordAttempt(false);
    expect(chain.progressPercent).toBe(25);
  });

  it('recordAttempt on non-active is a no-op', () => {
    const chain = EscalationChain.createDefault('task-001');
    const same = chain.recordAttempt(false);
    expect(same).toBe(chain);
  });
});
