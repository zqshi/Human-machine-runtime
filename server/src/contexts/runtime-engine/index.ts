export { MessageNormalizer } from './message-normalizer.js';
export type {
  NormalizedMessage,
  MessageIntent,
  MessageUrgency,
  ExtractedEntity,
} from './message-normalizer.js';

export { PriorityScorer } from './priority-scorer.js';
export type { PriorityScore, PriorityFactor } from './priority-scorer.js';

export { DedupEngine } from './dedup-engine.js';
export type { DedupResult } from './dedup-engine.js';

export { RecommendationEngine } from './recommendation-engine.js';
export type {
  DecisionContext,
  Recommendation,
  RecommendationResult,
  AlternativeAction,
} from './recommendation-engine.js';

export { ReceiptManager } from './receipt-manager.js';
export type { ExecutionReceipt, ReceiptStatus } from './receipt-manager.js';
