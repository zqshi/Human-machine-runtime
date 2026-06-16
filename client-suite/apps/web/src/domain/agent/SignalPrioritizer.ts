import { DecisionRequest, type DecisionUrgency } from './DecisionRequest';
import { Signal, type SignalUrgency } from './Signal';

type UrgencyLevel = DecisionUrgency | SignalUrgency;

const URGENCY_WEIGHTS: Record<UrgencyLevel, number> = {
  critical: 100,
  high: 75,
  normal: 40,
  low: 10,
};

const W_URGENCY = 0.4;
const W_DEADLINE = 0.35;
const W_IMPACT = 0.25;

const MAX_DEADLINE_WINDOW_MS = 24 * 60 * 60 * 1000;
const DECAY_HALF_LIFE_MS = 4 * 60 * 60 * 1000;

export class SignalPrioritizer {
  static computeScore(decision: DecisionRequest, now: number): number {
    const urgencyScore = URGENCY_WEIGHTS[decision.urgency];

    const remaining = Math.max(0, decision.deadline - now);
    const ratio = Math.min(1, remaining / MAX_DEADLINE_WINDOW_MS);
    const deadlineScore = (1 - ratio) * 100;

    const impactScore = Math.min(100, (decision.impactScope ?? 0) * 10);

    return urgencyScore * W_URGENCY + deadlineScore * W_DEADLINE + impactScore * W_IMPACT;
  }

  static computeSignalScore(signal: Signal, now: number): number {
    const urgencyScore = URGENCY_WEIGHTS[signal.urgency];

    const remaining = Math.max(0, signal.deadline - now);
    const ratio = Math.min(1, remaining / MAX_DEADLINE_WINDOW_MS);
    const deadlineScore = (1 - ratio) * 100;

    const impactScore = Math.min(100, signal.impactScope * 10);

    const baseScore =
      urgencyScore * W_URGENCY + deadlineScore * W_DEADLINE + impactScore * W_IMPACT;

    const age = now - signal.createdAt;
    const decayFactor = Math.pow(0.5, age / DECAY_HALF_LIFE_MS);

    return baseScore * decayFactor;
  }

  static prioritize(
    decisions: readonly DecisionRequest[],
    now: number = Date.now()
  ): DecisionRequest[] {
    if (decisions.length === 0) return [];

    return [...decisions].sort((a, b) => {
      const scoreA = SignalPrioritizer.computeScore(a, now);
      const scoreB = SignalPrioritizer.computeScore(b, now);
      return scoreB - scoreA;
    });
  }

  static prioritizeSignals(signals: readonly Signal[], now: number = Date.now()): Signal[] {
    if (signals.length === 0) return [];

    return [...signals]
      .filter((s) => s.isActive)
      .sort((a, b) => {
        const scoreA = SignalPrioritizer.computeSignalScore(a, now);
        const scoreB = SignalPrioritizer.computeSignalScore(b, now);
        return scoreB - scoreA;
      });
  }
}
