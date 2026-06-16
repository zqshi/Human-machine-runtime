/**
 * DeviationReport — 偏差报告值对象
 *
 * 记录假设与实际之间的偏差，含建议调整。
 */

export type DeviationDegree = 'none' | 'minor' | 'moderate' | 'severe';

export interface DeviationItem {
  readonly hypothesisId: string;
  readonly hypothesisStatement: string;
  readonly expectedValue: number;
  readonly actualValue: number;
  readonly deviationDegree: DeviationDegree;
  readonly suggestedAdjustment: string;
}

export interface DeviationReportProps {
  id: string;
  l0ObjectiveId: string;
  items: DeviationItem[];
  overallHealth: DeviationDegree;
  generatedAt: number;
  recommendations: string[];
}

export class DeviationReport {
  readonly id: string;
  readonly l0ObjectiveId: string;
  readonly items: readonly DeviationItem[];
  readonly overallHealth: DeviationDegree;
  readonly generatedAt: number;
  readonly recommendations: readonly string[];

  private constructor(props: DeviationReportProps) {
    this.id = props.id;
    this.l0ObjectiveId = props.l0ObjectiveId;
    this.items = props.items;
    this.overallHealth = props.overallHealth;
    this.generatedAt = props.generatedAt;
    this.recommendations = props.recommendations;
  }

  static generate(l0ObjectiveId: string, items: DeviationItem[]): DeviationReport {
    const overallHealth = DeviationReport.computeOverallHealth(items);
    const recommendations = DeviationReport.generateRecommendations(items, overallHealth);

    return new DeviationReport({
      id: `dr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      l0ObjectiveId,
      items,
      overallHealth,
      generatedAt: Date.now(),
      recommendations,
    });
  }

  static fromProps(props: DeviationReportProps): DeviationReport {
    return new DeviationReport(props);
  }

  get severeCount(): number {
    return this.items.filter((i) => i.deviationDegree === 'severe').length;
  }

  get moderateCount(): number {
    return this.items.filter((i) => i.deviationDegree === 'moderate').length;
  }

  get healthyCount(): number {
    return this.items.filter((i) => i.deviationDegree === 'none' || i.deviationDegree === 'minor')
      .length;
  }

  needsEscalation(): boolean {
    return this.overallHealth === 'severe' || this.severeCount >= 2;
  }

  private static computeOverallHealth(items: DeviationItem[]): DeviationDegree {
    if (items.length === 0) return 'none';
    const severeCount = items.filter((i) => i.deviationDegree === 'severe').length;
    const moderateCount = items.filter((i) => i.deviationDegree === 'moderate').length;

    if (severeCount >= 2) return 'severe';
    if (severeCount >= 1) return 'moderate';
    if (moderateCount >= 2) return 'moderate';
    if (moderateCount >= 1) return 'minor';
    return 'none';
  }

  private static generateRecommendations(
    items: DeviationItem[],
    health: DeviationDegree
  ): string[] {
    const recs: string[] = [];
    if (health === 'severe') {
      recs.push('建议立即召集战略对齐会议');
      recs.push('重新评估 L0 假设的有效性');
    }
    if (health === 'moderate') {
      recs.push('建议在下一周期重点关注偏差领域');
    }
    const severeItems = items.filter((i) => i.deviationDegree === 'severe');
    for (const item of severeItems) {
      recs.push(item.suggestedAdjustment);
    }
    return recs;
  }
}
