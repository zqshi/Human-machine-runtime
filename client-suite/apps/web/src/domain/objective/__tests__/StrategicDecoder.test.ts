import { describe, it, expect } from 'vitest';
import { StrategicDecoder } from '../StrategicDecoder';

describe('StrategicDecoder', () => {
  it('decodes intent into structured output', () => {
    const result = StrategicDecoder.decode('提升客户满意度到95%');
    expect(result.originalIntent).toBe('提升客户满意度到95%');
    expect(result.questions.length).toBeGreaterThan(0);
    expect(result.hypotheses.length).toBeGreaterThan(0);
    expect(result.suggestedL1Objectives.length).toBeGreaterThan(0);
  });

  it('generates questions with proper categories', () => {
    const questions = StrategicDecoder.generateQuestions('扩大市场份额');
    const categories = new Set(questions.map((q) => q.category));
    expect(categories.has('measurement')).toBe(true);
    expect(categories.has('risk')).toBe(true);
    expect(categories.has('constraint')).toBe(true);
  });

  it('generates follow-up questions for measurement', () => {
    const question = {
      id: 'q1',
      question: 'test',
      category: 'measurement' as const,
      priority: 'high' as const,
    };
    const followUps = StrategicDecoder.generateFollowUp(question, '收入增长率');
    expect(followUps.length).toBeGreaterThan(0);
    expect(followUps[0].category).toBe('measurement');
  });

  it('infers constraints from keywords', () => {
    const result = StrategicDecoder.decode('在预算范围内完成合规升级');
    expect(result.identifiedConstraints).toContain('预算约束');
    expect(result.identifiedConstraints).toContain('合规约束');
  });

  it('returns default constraint when no keywords match', () => {
    const result = StrategicDecoder.decode('探索新方向');
    expect(result.identifiedConstraints).toContain('待明确约束');
  });
});
