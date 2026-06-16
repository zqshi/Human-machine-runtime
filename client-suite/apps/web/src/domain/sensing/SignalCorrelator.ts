/**
 * SignalCorrelator — 跨 Agent 信号关联
 *
 * 在时间窗口内将来自不同 Agent 的相似信号聚合，
 * 识别系统级模式（如 3+ Agent 同时报类似异常）。
 */

import type { Signal, SignalSource } from '../agent/Signal';

export interface CorrelationGroup {
  readonly id: string;
  readonly signalIds: readonly string[];
  readonly pattern: string;
  readonly sourceAgents: readonly string[];
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly detectedAt: number;
  readonly windowMs: number;
}

export class SignalCorrelator {
  private readonly windowMs: number;
  private readonly minGroupSize: number;

  constructor(options?: { windowMs?: number; minGroupSize?: number }) {
    this.windowMs = options?.windowMs ?? 300_000;
    this.minGroupSize = options?.minGroupSize ?? 3;
  }

  correlate(signals: readonly Signal[]): CorrelationGroup[] {
    const now = Date.now();
    const recent = signals.filter(
      (s) => s.status === 'active' && now - s.createdAt <= this.windowMs
    );

    const groups: CorrelationGroup[] = [];
    const bySource = SignalCorrelator.groupBySource(recent);

    for (const [source, sourceSignals] of bySource) {
      if (sourceSignals.length < this.minGroupSize) continue;

      const agents = new Set(sourceSignals.map((s) => s.agentId).filter(Boolean));
      if (agents.size < this.minGroupSize) continue;

      groups.push({
        id: `corr-${now}-${source}`,
        signalIds: sourceSignals.map((s) => s.id),
        pattern: `Multiple agents reporting ${source} signals`,
        sourceAgents: Array.from(agents),
        severity: SignalCorrelator.computeSeverity(sourceSignals),
        detectedAt: now,
        windowMs: this.windowMs,
      });
    }

    const keywordGroups = this.correlateByKeyword(recent);
    groups.push(...keywordGroups);

    return groups;
  }

  private correlateByKeyword(signals: readonly Signal[]): CorrelationGroup[] {
    const groups: CorrelationGroup[] = [];
    const keywords = new Map<string, Signal[]>();

    for (const signal of signals) {
      const words = signal.payload.title.split(/\s+/).filter((w) => w.length > 2);
      for (const word of words) {
        const key = word.toLowerCase();
        if (!keywords.has(key)) keywords.set(key, []);
        keywords.get(key)!.push(signal);
      }
    }

    for (const [keyword, kwSignals] of keywords) {
      const agents = new Set(kwSignals.map((s) => s.agentId).filter(Boolean));
      if (agents.size < this.minGroupSize) continue;

      groups.push({
        id: `corr-kw-${Date.now()}-${keyword}`,
        signalIds: kwSignals.map((s) => s.id),
        pattern: `Keyword "${keyword}" from multiple agents`,
        sourceAgents: Array.from(agents),
        severity: SignalCorrelator.computeSeverity(kwSignals),
        detectedAt: Date.now(),
        windowMs: this.windowMs,
      });
    }

    return groups;
  }

  private static groupBySource(signals: readonly Signal[]): Map<SignalSource, Signal[]> {
    const map = new Map<SignalSource, Signal[]>();
    for (const s of signals) {
      if (!map.has(s.source)) map.set(s.source, []);
      map.get(s.source)!.push(s);
    }
    return map;
  }

  private static computeSeverity(signals: readonly Signal[]): CorrelationGroup['severity'] {
    const hasCritical = signals.some((s) => s.urgency === 'critical');
    if (hasCritical) return 'critical';
    const highCount = signals.filter((s) => s.urgency === 'high').length;
    if (highCount >= 3) return 'high';
    if (signals.length >= 5) return 'medium';
    return 'low';
  }
}
