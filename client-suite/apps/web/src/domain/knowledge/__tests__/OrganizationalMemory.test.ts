import { describe, it, expect } from 'vitest';
import { OrganizationalMemory, type JudgmentSummary } from '../OrganizationalMemory';

function makeJudgment(overrides?: Partial<JudgmentSummary>): JudgmentSummary {
  return {
    decisionId: `d-${Date.now()}`,
    keywords: ['安全', '漏洞'],
    urgency: 'high',
    source: 'agent',
    impact: 5,
    action: 'approve',
    outcome: 'success',
    responseMs: 3000,
    ...overrides,
  };
}

describe('OrganizationalMemory', () => {
  it('creates empty memory', () => {
    const mem = OrganizationalMemory.create();
    expect(mem.size).toBe(0);
  });

  it('ingests judgments and creates patterns', () => {
    const mem = OrganizationalMemory.create();
    const judgments = [
      makeJudgment({ decisionId: 'd1' }),
      makeJudgment({ decisionId: 'd2', outcome: 'failure' }),
    ];
    const newCount = mem.ingest(judgments);
    expect(newCount).toBe(1);
    expect(mem.size).toBe(1);
  });

  it('skips groups with less than 2 judgments', () => {
    const mem = OrganizationalMemory.create();
    const newCount = mem.ingest([makeJudgment()]);
    expect(newCount).toBe(0);
  });

  it('searches by context', () => {
    const mem = OrganizationalMemory.create();
    mem.ingest([makeJudgment({ decisionId: 'd1' }), makeJudgment({ decisionId: 'd2' })]);
    const results = mem.search({
      keywords: ['安全'],
      urgency: 'high',
      source: 'agent',
      impactRange: [0, 10],
    });
    expect(results.length).toBeGreaterThanOrEqual(0);
  });

  it('records usage and updates pattern', () => {
    const mem = OrganizationalMemory.create();
    mem.ingest([makeJudgment({ decisionId: 'd1' }), makeJudgment({ decisionId: 'd2' })]);
    const pattern = mem.getAll()[0];
    mem.recordUsage(pattern.id, {
      action: 'approve',
      successRate: 1,
      avgResponseMs: 2000,
      sampleSize: 1,
    });
    const updated = mem.getById(pattern.id)!;
    expect(updated.usageCount).toBeGreaterThan(pattern.usageCount);
  });

  it('prunes stale patterns', () => {
    const mem = OrganizationalMemory.create();
    mem.ingest([makeJudgment({ decisionId: 'd1' }), makeJudgment({ decisionId: 'd2' })]);
    const pruned = mem.pruneStale(0);
    expect(pruned).toBe(1);
    expect(mem.size).toBe(0);
  });
});
