import { newId, nowIso } from '../../../shared/utils.js';

/* ---------- Constants ---------- */

export const KB_TYPE = {
  DOCUMENT: 'document',
  FAQ: 'faq',
  WIKI: 'wiki',
} as const;
export type KbType = (typeof KB_TYPE)[keyof typeof KB_TYPE];

export const KB_STATUS = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  SYNCING: 'syncing',
  ERROR: 'error',
} as const;
export type KbStatus = (typeof KB_STATUS)[keyof typeof KB_STATUS];

export const SYNC_STATUS = {
  PENDING: 'pending',
  SYNCING: 'syncing',
  SYNCED: 'synced',
  FAILED: 'failed',
  SKIPPED: 'skipped',
} as const;
export type SyncStatus = (typeof SYNC_STATUS)[keyof typeof SYNC_STATUS];

export const PARSE_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;
export type ParseStatus = (typeof PARSE_STATUS)[keyof typeof PARSE_STATUS];

/* ---------- Value Objects ---------- */

export interface ChunkingConfig {
  chunkSize: number;
  chunkOverlap: number;
  separators?: string[];
}

export interface RetrievalConfig {
  topK: number;
  scoreThreshold: number;
  useHybridSearch: boolean;
  bm25Weight: number;
  vectorWeight: number;
}

const DEFAULT_CHUNKING: ChunkingConfig = {
  chunkSize: 512,
  chunkOverlap: 64,
};

const DEFAULT_RETRIEVAL: RetrievalConfig = {
  topK: 5,
  scoreThreshold: 0.5,
  useHybridSearch: true,
  bm25Weight: 0.3,
  vectorWeight: 0.7,
};

/* ---------- Entities ---------- */

export interface KnowledgeBase {
  id: string;
  tenantId: string;
  wkKnowledgeBaseId: string;
  name: string;
  description: string;
  type: KbType;
  status: KbStatus;
  embeddingModelId: string | null;
  chunkingConfig: ChunkingConfig;
  retrievalConfig: RetrievalConfig;
  documentCount: number;
  boundInstanceIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeEntry {
  id: string;
  knowledgeBaseId: string;
  tenantId: string;
  wkKnowledgeId: string;
  hmrDocumentId: string | null;
  title: string;
  sourceType: 'file' | 'url' | 'manual';
  parseStatus: ParseStatus;
  chunkCount: number;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
}

export interface RagQuery {
  tenantId: string;
  knowledgeBaseIds: string[];
  query: string;
  topK?: number;
  scoreThreshold?: number;
  stream: boolean;
}

export interface RagSource {
  knowledgeId: string;
  title: string;
  content: string;
  score: number;
}

export interface RagResult {
  answer: string;
  sources: RagSource[];
  tokenUsage?: { prompt: number; completion: number };
}

export interface SearchHit {
  knowledgeId: string;
  title: string;
  content: string;
  score: number;
  chunkId?: string;
}

/* ---------- Factory ---------- */

export interface CreateKbInput {
  tenantId: string;
  name: string;
  description?: string;
  type?: KbType;
  embeddingModelId?: string;
  chunkingConfig?: Partial<ChunkingConfig>;
  retrievalConfig?: Partial<RetrievalConfig>;
}

export function createKnowledgeBase(
  input: CreateKbInput,
  wkKnowledgeBaseId: string
): KnowledgeBase {
  const name = String(input.name || '').trim();
  if (!name) throw new Error('knowledge base name is required');
  if (name.length > 128) throw new Error('knowledge base name max 128 chars');

  const type =
    input.type && Object.values(KB_TYPE).includes(input.type) ? input.type : KB_TYPE.DOCUMENT;

  const now = nowIso();
  return {
    id: newId('kb'),
    tenantId: input.tenantId,
    wkKnowledgeBaseId,
    name,
    description: String(input.description || '').trim(),
    type,
    status: KB_STATUS.ACTIVE,
    embeddingModelId: input.embeddingModelId || null,
    chunkingConfig: {
      ...DEFAULT_CHUNKING,
      ...(input.chunkingConfig || {}),
    },
    retrievalConfig: {
      ...DEFAULT_RETRIEVAL,
      ...(input.retrievalConfig || {}),
    },
    documentCount: 0,
    boundInstanceIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function updateKnowledgeBase(
  kb: KnowledgeBase,
  patch: {
    name?: string;
    description?: string;
    chunkingConfig?: Partial<ChunkingConfig>;
    retrievalConfig?: Partial<RetrievalConfig>;
  }
): KnowledgeBase {
  const updated = { ...kb, updatedAt: nowIso() };
  if (patch.name !== undefined) {
    const name = String(patch.name).trim();
    if (!name) throw new Error('knowledge base name cannot be empty');
    if (name.length > 128) throw new Error('knowledge base name max 128 chars');
    updated.name = name;
  }
  if (patch.description !== undefined) {
    updated.description = String(patch.description).trim();
  }
  if (patch.chunkingConfig) {
    updated.chunkingConfig = { ...updated.chunkingConfig, ...patch.chunkingConfig };
  }
  if (patch.retrievalConfig) {
    updated.retrievalConfig = { ...updated.retrievalConfig, ...patch.retrievalConfig };
  }
  return updated;
}

export function archiveKnowledgeBase(kb: KnowledgeBase): KnowledgeBase {
  if (kb.status === KB_STATUS.ARCHIVED) throw new Error('knowledge base already archived');
  return { ...kb, status: KB_STATUS.ARCHIVED, updatedAt: nowIso() };
}

export function bindInstances(kb: KnowledgeBase, instanceIds: string[]): KnowledgeBase {
  const unique = [...new Set([...kb.boundInstanceIds, ...instanceIds])];
  return { ...kb, boundInstanceIds: unique, updatedAt: nowIso() };
}

export function unbindInstances(kb: KnowledgeBase, instanceIds: string[]): KnowledgeBase {
  const remove = new Set(instanceIds);
  return {
    ...kb,
    boundInstanceIds: kb.boundInstanceIds.filter((id) => !remove.has(id)),
    updatedAt: nowIso(),
  };
}

/* ---------- Validation ---------- */

export function validateChunkingConfig(cfg: Partial<ChunkingConfig>): string | null {
  if (cfg.chunkSize !== undefined && (cfg.chunkSize < 64 || cfg.chunkSize > 4096)) {
    return 'chunkSize must be between 64 and 4096';
  }
  if (cfg.chunkOverlap !== undefined && (cfg.chunkOverlap < 0 || cfg.chunkOverlap > 512)) {
    return 'chunkOverlap must be between 0 and 512';
  }
  if (
    cfg.chunkSize !== undefined &&
    cfg.chunkOverlap !== undefined &&
    cfg.chunkOverlap >= cfg.chunkSize
  ) {
    return 'chunkOverlap must be less than chunkSize';
  }
  return null;
}

export function validateRetrievalConfig(cfg: Partial<RetrievalConfig>): string | null {
  if (cfg.topK !== undefined && (cfg.topK < 1 || cfg.topK > 50)) {
    return 'topK must be between 1 and 50';
  }
  if (cfg.scoreThreshold !== undefined && (cfg.scoreThreshold < 0 || cfg.scoreThreshold > 1)) {
    return 'scoreThreshold must be between 0 and 1';
  }
  if (cfg.bm25Weight !== undefined && (cfg.bm25Weight < 0 || cfg.bm25Weight > 1)) {
    return 'bm25Weight must be between 0 and 1';
  }
  if (cfg.vectorWeight !== undefined && (cfg.vectorWeight < 0 || cfg.vectorWeight > 1)) {
    return 'vectorWeight must be between 0 and 1';
  }
  return null;
}
