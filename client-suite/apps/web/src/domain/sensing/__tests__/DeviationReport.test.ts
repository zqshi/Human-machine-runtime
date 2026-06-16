import { describe, it, expect } from 'vitest';
import { DeviationReport } from '../DeviationReport';
import type { DeviationItem } from '../DeviationReport';

describe('DeviationReport', () => {
  const severeItem: DeviationItem = {
    hypothesisId: 'h1',
    hypothesisStatement: 'test',
    expectedValue: 100,
    actualValue: 20,
    deviationDegree: 'severe',
    suggestedAdjustment: '重新评估',
  };
  const minorItem: DeviationItem = {
    hypothesisId: 'h2',
    hypothesisStatement: 'test2',
    expectedValue: 100,
    actualValue: 85,
    deviationDegree: 'minor',
    suggestedAdjustment: '微调',
  };

  it('generates report with correct health assessment', () => {
    const report = DeviationReport.generate('l0-1', [severeItem, minorItem]);
    expect(report.l0ObjectiveId).toBe('l0-1');
    expect(report.overallHealth).toBe('moderate');
  });

  it('counts severe and healthy items', () => {
    const report = DeviationReport.generate('l0-1', [severeItem, severeItem, minorItem]);
    expect(report.severeCount).toBe(2);
    expect(report.healthyCount).toBe(1);
    expect(report.overallHealth).toBe('severe');
  });

  it('needsEscalation for severe overall health', () => {
    const report = DeviationReport.generate('l0-1', [severeItem, severeItem]);
    expect(report.needsEscalation()).toBe(true);
  });

  it('generates recommendations for severe health', () => {
    const report = DeviationReport.generate('l0-1', [severeItem]);
    expect(report.recommendations.length).toBeGreaterThan(0);
  });

  it('returns none health for empty items', () => {
    const report = DeviationReport.generate('l0-1', []);
    expect(report.overallHealth).toBe('none');
    expect(report.needsEscalation()).toBe(false);
  });
});
