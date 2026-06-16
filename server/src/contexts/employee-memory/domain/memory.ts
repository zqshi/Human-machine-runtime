import { newId, nowIso } from '../../../shared/utils.js';

/* ---------- Constants ---------- */

/** Sentinel userId for organization-level shared memory fragments */
export const ORG_USER_ID = '__org__';

export const FRAGMENT_SCOPE = {
  ORG: 'org', // agent 级共享（原 __org__ 哨兵；一个数字员工内多用户共享）
  PERSONAL: 'personal',
  DEPT: 'dept_shared', // 部门级跨 Agent 共享（挂 Mem0 app entity，部门下所有 agent/用户共用）
} as const;
export type FragmentScope = (typeof FRAGMENT_SCOPE)[keyof typeof FRAGMENT_SCOPE];

export const FRAGMENT_TYPE = {
  PREFERENCE: 'preference',
  FACT: 'fact',
  INTERACTION_SUMMARY: 'interaction_summary',
  FEEDBACK: 'feedback',
} as const;
export type FragmentType = (typeof FRAGMENT_TYPE)[keyof typeof FRAGMENT_TYPE];

export const FRAGMENT_SOURCE = {
  AUTO_EXTRACTED: 'auto_extracted',
  MANUAL: 'manual',
  RULE_GENERATED: 'rule_generated',
} as const;
export type FragmentSource = (typeof FRAGMENT_SOURCE)[keyof typeof FRAGMENT_SOURCE];

export const RULE_TYPE = {
  FRAGMENT_RULE: 'fragment_rule',
  PROFILE_RULE: 'profile_rule',
  CONSENSUS_RULE: 'consensus_rule',
} as const;
export type MemoryRuleType = (typeof RULE_TYPE)[keyof typeof RULE_TYPE];

export const STORE_STATUS = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
} as const;
export type StoreStatus = (typeof STORE_STATUS)[keyof typeof STORE_STATUS];

/* ---------- Retrieval Config ---------- */

export interface RetrievalConfig {
  topK: number;
  scoreThreshold: number;
  maxMemoryAge: number; // days, 0 = no limit
  memoryTypes: FragmentType[];
  useKeywordSearch: boolean;
  useVectorSearch: boolean;
  keywordWeight: number;
  vectorWeight: number;
}

const DEFAULT_RETRIEVAL: RetrievalConfig = {
  topK: 5,
  scoreThreshold: 0.3,
  maxMemoryAge: 0,
  memoryTypes: [],
  useKeywordSearch: true,
  useVectorSearch: false,
  keywordWeight: 0.4,
  vectorWeight: 0.6,
};

/* ---------- Memory Store ---------- */

export interface MemoryStore {
  id: string;
  instanceId: string;
  tenantId: string;
  name: string;
  description: string;
  retrievalConfig: RetrievalConfig;
  status: StoreStatus;
  totalFragments: number;
  totalProfiles: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemoryStoreInput {
  instanceId: string;
  tenantId: string;
  name: string;
  description?: string;
  retrievalConfig?: Partial<RetrievalConfig>;
}

export function createMemoryStore(input: CreateMemoryStoreInput): MemoryStore {
  const name = String(input.name || '').trim();
  if (!name) throw new Error('memory store name is required');
  if (name.length > 128) throw new Error('memory store name max 128 chars');

  const now = nowIso();
  return {
    id: newId('mem'),
    instanceId: input.instanceId,
    tenantId: input.tenantId,
    name,
    description: String(input.description || '').trim(),
    retrievalConfig: {
      ...DEFAULT_RETRIEVAL,
      ...(input.retrievalConfig || {}),
    },
    status: STORE_STATUS.ACTIVE,
    totalFragments: 0,
    totalProfiles: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/* ---------- Memory Fragment ---------- */

export interface MemoryFragment {
  id: string;
  memoryStoreId: string;
  tenantId: string;
  userId: string;
  scope: FragmentScope;
  departmentId: string | null;
  type: FragmentType;
  content: string;
  source: FragmentSource;
  importance: number;
  accessCount: number;
  lastAccessedAt: string | null;
  expiresAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemoryFragmentInput {
  memoryStoreId: string;
  tenantId: string;
  userId: string;
  scope?: FragmentScope;
  departmentId?: string | null;
  type: FragmentType;
  content: string;
  source?: FragmentSource;
  importance?: number;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
}

const VALID_FRAGMENT_TYPES = new Set<string>(Object.values(FRAGMENT_TYPE));
const VALID_FRAGMENT_SOURCES = new Set<string>(Object.values(FRAGMENT_SOURCE));

export function createMemoryFragment(input: CreateMemoryFragmentInput): MemoryFragment {
  const content = String(input.content || '').trim();
  if (!content) throw new Error('fragment content is required');

  const userId = String(input.userId || '').trim();
  if (!userId) throw new Error('fragment userId is required');

  if (!VALID_FRAGMENT_TYPES.has(input.type)) {
    throw new Error(`invalid fragment type: ${input.type}`);
  }

  const source = input.source || FRAGMENT_SOURCE.MANUAL;
  if (!VALID_FRAGMENT_SOURCES.has(source)) {
    throw new Error(`invalid fragment source: ${source}`);
  }

  const importance = input.importance ?? 5;
  if (importance < 1 || importance > 10) {
    throw new Error('importance must be between 1 and 10');
  }

  const now = nowIso();
  return {
    id: newId('mf'),
    memoryStoreId: input.memoryStoreId,
    tenantId: input.tenantId,
    userId,
    scope: input.scope ?? (userId === ORG_USER_ID ? FRAGMENT_SCOPE.ORG : FRAGMENT_SCOPE.PERSONAL),
    departmentId: input.departmentId ?? null,
    type: input.type,
    content,
    source,
    importance,
    accessCount: 0,
    lastAccessedAt: null,
    expiresAt: input.expiresAt ?? null,
    metadata: input.metadata ?? {},
    createdAt: now,
    updatedAt: now,
  };
}

/* ---------- Memory Rule ---------- */

export interface MemoryRule {
  id: string;
  memoryStoreId: string;
  tenantId: string;
  ruleType: MemoryRuleType;
  name: string;
  description: string;
  trigger: {
    event?: string;
    conditions?: Record<string, unknown>;
  };
  action: {
    type?: string;
    params?: Record<string, unknown>;
  };
  priority: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemoryRuleInput {
  memoryStoreId: string;
  tenantId: string;
  ruleType: MemoryRuleType;
  name: string;
  description?: string;
  trigger?: MemoryRule['trigger'];
  action?: MemoryRule['action'];
  priority?: number;
  enabled?: boolean;
}

const VALID_RULE_TYPES = new Set<string>(Object.values(RULE_TYPE));

export function createMemoryRule(input: CreateMemoryRuleInput): MemoryRule {
  const name = String(input.name || '').trim();
  if (!name) throw new Error('rule name is required');
  if (name.length > 128) throw new Error('rule name max 128 chars');

  if (!VALID_RULE_TYPES.has(input.ruleType)) {
    throw new Error(`invalid rule type: ${input.ruleType}`);
  }

  const now = nowIso();
  return {
    id: newId('mr'),
    memoryStoreId: input.memoryStoreId,
    tenantId: input.tenantId,
    ruleType: input.ruleType,
    name,
    description: String(input.description || '').trim(),
    trigger: input.trigger ?? {},
    action: input.action ?? {},
    priority: input.priority ?? 0,
    enabled: input.enabled ?? true,
    createdAt: now,
    updatedAt: now,
  };
}

/* ---------- Scope Helper ---------- */

export function scopeOfFragment(fragment: Pick<MemoryFragment, 'scope' | 'userId'>): FragmentScope {
  // scope 列为权威；兼容旧数据（无 scope 时按 userId 哨兵推断）
  if (fragment.scope === FRAGMENT_SCOPE.ORG || fragment.scope === FRAGMENT_SCOPE.DEPT) {
    return fragment.scope;
  }
  return fragment.userId === ORG_USER_ID ? FRAGMENT_SCOPE.ORG : FRAGMENT_SCOPE.PERSONAL;
}

/* ---------- Validation ---------- */

export function validateRetrievalConfig(cfg: Partial<RetrievalConfig>): string | null {
  if (cfg.topK !== undefined && (cfg.topK < 1 || cfg.topK > 50)) {
    return 'topK must be between 1 and 50';
  }
  if (cfg.scoreThreshold !== undefined && (cfg.scoreThreshold < 0 || cfg.scoreThreshold > 1)) {
    return 'scoreThreshold must be between 0 and 1';
  }
  if (cfg.maxMemoryAge !== undefined && cfg.maxMemoryAge < 0) {
    return 'maxMemoryAge must be non-negative';
  }
  if (cfg.keywordWeight !== undefined && (cfg.keywordWeight < 0 || cfg.keywordWeight > 1)) {
    return 'keywordWeight must be between 0 and 1';
  }
  if (cfg.vectorWeight !== undefined && (cfg.vectorWeight < 0 || cfg.vectorWeight > 1)) {
    return 'vectorWeight must be between 0 and 1';
  }
  if (
    cfg.useKeywordSearch === false &&
    cfg.useVectorSearch === false
  ) {
    return 'at least one search channel must be enabled';
  }
  return null;
}

export function validateRuleTrigger(trigger: MemoryRule['trigger']): string | null {
  const validEvents = new Set([
    'message_sent',
    'conversation_end',
    'feedback_received',
  ]);
  if (trigger.event && !validEvents.has(trigger.event)) {
    return `invalid trigger event: ${trigger.event}`;
  }
  return null;
}

/* ---------- Search Result ---------- */

export interface MemorySearchHit {
  fragmentId: string;
  userId: string;
  type: FragmentType;
  content: string;
  importance: number;
  score: number;
  keywordScore?: number;
  vectorScore?: number;
  source: FragmentSource;
  origin?: 'personal' | 'agent' | 'dept';
  createdAt: string;
}

export interface MemorySearchResult {
  hits: MemorySearchHit[];
  total: number;
  channels: {
    keyword: boolean;
    vector: boolean;
  };
}
