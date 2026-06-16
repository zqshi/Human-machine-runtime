/**
 * PatternDetector — 规则驱动的异常模式检测
 *
 * 从 CorrelationGroup 中提取可操作的模式，
 * 生成 EmergentSignal。
 */

import type { CorrelationGroup } from './SignalCorrelator';

export interface DetectionRule {
  readonly id: string;
  readonly name: string;
  readonly minSignals: number;
  readonly minAgents: number;
  readonly sourceFilter?: string;
  readonly severityOverride?: 'low' | 'medium' | 'high' | 'critical';
}

export interface DetectedPattern {
  readonly id: string;
  readonly ruleId: string;
  readonly ruleName: string;
  readonly correlationGroupId: string;
  readonly signalCount: number;
  readonly agentCount: number;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly suggestedAction: string;
  readonly detectedAt: number;
}

const DEFAULT_RULES: DetectionRule[] = [
  {
    id: 'rule-cascade-failure',
    name: '级联失败',
    minSignals: 3,
    minAgents: 3,
    sourceFilter: 'task-exception',
    severityOverride: 'critical',
  },
  { id: 'rule-multi-agent-anomaly', name: '多 Agent 异常', minSignals: 3, minAgents: 3 },
  {
    id: 'rule-goal-alert-cluster',
    name: '目标预警聚集',
    minSignals: 2,
    minAgents: 2,
    sourceFilter: 'goal-alert',
    severityOverride: 'high',
  },
];

export class PatternDetector {
  private readonly rules: DetectionRule[];

  constructor(rules?: DetectionRule[]) {
    this.rules = rules ?? DEFAULT_RULES;
  }

  detect(groups: readonly CorrelationGroup[]): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];

    for (const group of groups) {
      for (const rule of this.rules) {
        if (this.matches(group, rule)) {
          patterns.push({
            id: `pat-${Date.now()}-${rule.id}`,
            ruleId: rule.id,
            ruleName: rule.name,
            correlationGroupId: group.id,
            signalCount: group.signalIds.length,
            agentCount: group.sourceAgents.length,
            severity: rule.severityOverride ?? group.severity,
            suggestedAction: this.suggestAction(rule, group),
            detectedAt: Date.now(),
          });
        }
      }
    }

    return patterns;
  }

  private matches(group: CorrelationGroup, rule: DetectionRule): boolean {
    if (group.signalIds.length < rule.minSignals) return false;
    if (group.sourceAgents.length < rule.minAgents) return false;
    if (rule.sourceFilter && !group.pattern.includes(rule.sourceFilter)) return false;
    return true;
  }

  private suggestAction(rule: DetectionRule, _group: CorrelationGroup): string {
    switch (rule.id) {
      case 'rule-cascade-failure':
        return '紧急暂停相关 Agent，检查共同依赖';
      case 'rule-multi-agent-anomaly':
        return '通知管理员，启动系统级诊断';
      case 'rule-goal-alert-cluster':
        return '审查相关目标设定合理性';
      default:
        return '需要人工审查';
    }
  }

  addRule(rule: DetectionRule): PatternDetector {
    return new PatternDetector([...this.rules, rule]);
  }
}
