import { randomUUID } from 'crypto';
import { logger as appLogger } from '../../app/logger.js';
import { AppError, newId, nowIso } from '../../shared/utils.js';
import type { WeKnoraClient, WkSearchResult } from '../gateway/clients/weknora-client.js';
import type {
  IWkMappingRepository,
  WkTenantMapping,
} from '../../db/repositories/weknora-mapping-repository.js';
import {
  type KnowledgeBase,
  type KnowledgeEntry,
  type CreateKbInput,
  type RagResult,
  type RagSource,
  type SearchHit,
  type SyncStatus,
  createKnowledgeBase,
  updateKnowledgeBase,
  archiveKnowledgeBase,
  bindInstances,
  unbindInstances,
  validateChunkingConfig,
  validateRetrievalConfig,
} from './domain/knowledge.js';

/* ---------- Repository Interfaces ---------- */

export interface IKnowledgeBaseRepository {
  findByTenantId(tenantId: string): Promise<KnowledgeBase[]>;
  findById(id: string): Promise<KnowledgeBase | null>;
  findByWkId(wkKnowledgeBaseId: string): Promise<KnowledgeBase | null>;
  save(kb: KnowledgeBase): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface IKnowledgeEntryRepository {
  findByKbId(knowledgeBaseId: string): Promise<KnowledgeEntry[]>;
  findById(id: string): Promise<KnowledgeEntry | null>;
  findByHmrDocumentId(hmrDocumentId: string): Promise<KnowledgeEntry | null>;
  save(entry: KnowledgeEntry): Promise<void>;
  updateSyncStatus(id: string, status: SyncStatus): Promise<void>;
  delete(id: string): Promise<void>;
}

/* ---------- Encryption ---------- */

export interface IEncryption {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
}

/* ---------- Logger ---------- */

interface Logger {
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
}

const consoleLogger: Logger = {
  info: (msg, data) => appLogger.info(data ?? {}, `[knowledge] ${msg}`),
  warn: (msg, data) => appLogger.warn(data ?? {}, `[knowledge] ${msg}`),
  error: (msg, data) => appLogger.error(data ?? {}, `[knowledge] ${msg}`),
};

/* ---------- Service ---------- */

export class KnowledgeService {
  private client: WeKnoraClient;
  private mappingRepo: IWkMappingRepository;
  private kbRepo: IKnowledgeBaseRepository;
  private entryRepo: IKnowledgeEntryRepository;
  private encryption: IEncryption;
  private logger: Logger;

  constructor(deps: {
    client: WeKnoraClient;
    mappingRepo: IWkMappingRepository;
    kbRepo: IKnowledgeBaseRepository;
    entryRepo: IKnowledgeEntryRepository;
    encryption: IEncryption;
    logger?: Logger;
  }) {
    this.client = deps.client;
    this.mappingRepo = deps.mappingRepo;
    this.kbRepo = deps.kbRepo;
    this.entryRepo = deps.entryRepo;
    this.encryption = deps.encryption;
    this.logger = deps.logger || consoleLogger;
  }

  /* ---- Tenant Provisioning ---- */

  async provisionTenant(
    hmrTenantId: string,
    tenantSlug: string,
    tenantName: string
  ): Promise<WkTenantMapping> {
    const existing = await this.mappingRepo.getByHmrTenantId(hmrTenantId);
    if (existing) return existing;

    const username = `hmr-${tenantSlug}`;
    const password = randomUUID();

    this.logger.info('provisioning WeKnora tenant', { hmrTenantId, username });

    const reg = await this.client.registerTenant(username, password);

    let apiKey = reg.api_key || '';
    if (!apiKey && reg.tenant_id) {
      const keyResult = await this.client.getTenantApiKey(reg.tenant_id);
      apiKey = keyResult.api_key;
    }

    const mapping: WkTenantMapping = {
      id: newId('wkm'),
      hmrTenantId,
      wkTenantId: reg.tenant_id,
      wkUserId: reg.user_id,
      wkApiKey: this.encryption.encrypt(apiKey),
      wkBaseUrl: null,
      status: 'active',
      defaultKbId: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    await this.mappingRepo.save(mapping);

    try {
      const defaultKb = await this.client.createKnowledgeBase(apiKey, {
        name: `${tenantName} 默认知识库`,
        description: `${tenantName} 的默认文档知识库`,
        type: 'document',
      });
      mapping.defaultKbId = defaultKb.id;
      await this.mappingRepo.updateDefaultKbId(hmrTenantId, defaultKb.id);
    } catch (err) {
      this.logger.warn('failed to create default KB, will retry later', {
        hmrTenantId,
        error: String(err),
      });
    }

    this.logger.info('WeKnora tenant provisioned', {
      hmrTenantId,
      wkTenantId: reg.tenant_id,
    });

    return mapping;
  }

  async deprovisionTenant(hmrTenantId: string): Promise<void> {
    await this.mappingRepo.updateStatus(hmrTenantId, 'deprovisioned');
    this.logger.info('WeKnora tenant deprovisioned', { hmrTenantId });
  }

  /* ---- Knowledge Base CRUD ---- */

  async listKnowledgeBases(tenantId: string): Promise<KnowledgeBase[]> {
    return this.kbRepo.findByTenantId(tenantId);
  }

  async getKnowledgeBase(id: string): Promise<KnowledgeBase> {
    const kb = await this.kbRepo.findById(id);
    if (!kb) throw new AppError('knowledge base not found', 404, 'KB_NOT_FOUND');
    return kb;
  }

  async createKnowledgeBase(input: CreateKbInput): Promise<KnowledgeBase> {
    if (input.chunkingConfig) {
      const err = validateChunkingConfig(input.chunkingConfig);
      if (err) throw new AppError(err, 400, 'KB_INVALID_CHUNKING');
    }
    if (input.retrievalConfig) {
      const err = validateRetrievalConfig(input.retrievalConfig);
      if (err) throw new AppError(err, 400, 'KB_INVALID_RETRIEVAL');
    }

    const apiKey = await this.resolveApiKey(input.tenantId);

    const wkKb = await this.client.createKnowledgeBase(apiKey, {
      name: input.name,
      description: input.description,
      type: input.type || 'document',
      embedding_model_id: input.embeddingModelId,
      chunking_config: input.chunkingConfig
        ? {
            chunk_size: input.chunkingConfig.chunkSize,
            chunk_overlap: input.chunkingConfig.chunkOverlap,
            separators: input.chunkingConfig.separators,
          }
        : undefined,
    });

    const kb = createKnowledgeBase(input, wkKb.id);
    await this.kbRepo.save(kb);
    this.logger.info('knowledge base created', { id: kb.id, wkId: wkKb.id });
    return kb;
  }

  async updateKnowledgeBase(
    id: string,
    patch: {
      name?: string;
      description?: string;
      chunkingConfig?: KnowledgeBase['chunkingConfig'];
      retrievalConfig?: KnowledgeBase['retrievalConfig'];
    }
  ): Promise<KnowledgeBase> {
    const kb = await this.getKnowledgeBase(id);
    if (patch.chunkingConfig) {
      const err = validateChunkingConfig(patch.chunkingConfig);
      if (err) throw new AppError(err, 400, 'KB_INVALID_CHUNKING');
    }
    if (patch.retrievalConfig) {
      const err = validateRetrievalConfig(patch.retrievalConfig);
      if (err) throw new AppError(err, 400, 'KB_INVALID_RETRIEVAL');
    }

    const apiKey = await this.resolveApiKey(kb.tenantId);
    await this.client.updateKnowledgeBase(apiKey, kb.wkKnowledgeBaseId, {
      name: patch.name,
      description: patch.description,
    });

    const updated = updateKnowledgeBase(kb, patch);
    await this.kbRepo.save(updated);
    return updated;
  }

  async archiveKnowledgeBase(id: string): Promise<KnowledgeBase> {
    const kb = await this.getKnowledgeBase(id);
    const apiKey = await this.resolveApiKey(kb.tenantId);
    await this.client.deleteKnowledgeBase(apiKey, kb.wkKnowledgeBaseId);
    const archived = archiveKnowledgeBase(kb);
    await this.kbRepo.save(archived);
    this.logger.info('knowledge base archived', { id });
    return archived;
  }

  /* ---- Instance Binding ---- */

  async bindToInstances(kbId: string, instanceIds: string[]): Promise<KnowledgeBase> {
    const kb = await this.getKnowledgeBase(kbId);
    const updated = bindInstances(kb, instanceIds);
    await this.kbRepo.save(updated);
    return updated;
  }

  async unbindFromInstances(kbId: string, instanceIds: string[]): Promise<KnowledgeBase> {
    const kb = await this.getKnowledgeBase(kbId);
    const updated = unbindInstances(kb, instanceIds);
    await this.kbRepo.save(updated);
    return updated;
  }

  /* ---- Document Sync ---- */

  async syncDocument(
    tenantId: string,
    kbId: string,
    doc: { id: string; title: string; content: string; type?: string }
  ): Promise<KnowledgeEntry> {
    const kb = await this.getKnowledgeBase(kbId);
    if (kb.tenantId !== tenantId) {
      throw new AppError('knowledge base does not belong to tenant', 403, 'KB_TENANT_MISMATCH');
    }

    const existing = await this.entryRepo.findByHmrDocumentId(doc.id);
    const apiKey = await this.resolveApiKey(tenantId);

    // 先上传新内容，成功后再删旧——避免上传失败时旧知识已被删、新知识未传造成数据丢失
    const wkKnowledge = await this.client.uploadManualKnowledge(apiKey, kb.wkKnowledgeBaseId, {
      title: doc.title,
      content: doc.content,
      metadata: {
        source: 'hmr',
        documentId: doc.id,
        type: doc.type || 'doc',
      },
    });

    if (existing) {
      await this.client.deleteKnowledge(apiKey, kb.wkKnowledgeBaseId, existing.wkKnowledgeId);
      await this.entryRepo.delete(existing.id);
    }

    const entry: KnowledgeEntry = {
      id: newId('ke'),
      knowledgeBaseId: kbId,
      tenantId,
      wkKnowledgeId: wkKnowledge.id,
      hmrDocumentId: doc.id,
      title: doc.title,
      sourceType: 'manual',
      parseStatus: (wkKnowledge.parse_status as KnowledgeEntry['parseStatus']) || 'pending',
      chunkCount: wkKnowledge.chunk_count || 0,
      fileSize: wkKnowledge.file_size || doc.content.length,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    await this.entryRepo.save(entry);
    this.logger.info('document synced to WeKnora', {
      hmrDocId: doc.id,
      wkKnowledgeId: wkKnowledge.id,
    });
    return entry;
  }

  async syncDocumentByUrl(
    tenantId: string,
    kbId: string,
    input: { url: string; metadata?: Record<string, unknown> }
  ): Promise<KnowledgeEntry> {
    const kb = await this.getKnowledgeBase(kbId);
    if (kb.tenantId !== tenantId) {
      throw new AppError('knowledge base does not belong to tenant', 403, 'KB_TENANT_MISMATCH');
    }

    const apiKey = await this.resolveApiKey(tenantId);
    const wkKnowledge = await this.client.uploadUrlKnowledge(apiKey, kb.wkKnowledgeBaseId, input);

    const entry: KnowledgeEntry = {
      id: newId('ke'),
      knowledgeBaseId: kbId,
      tenantId,
      wkKnowledgeId: wkKnowledge.id,
      hmrDocumentId: null,
      title: wkKnowledge.title || input.url,
      sourceType: 'url',
      parseStatus: (wkKnowledge.parse_status as KnowledgeEntry['parseStatus']) || 'pending',
      chunkCount: wkKnowledge.chunk_count || 0,
      fileSize: wkKnowledge.file_size || 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    await this.entryRepo.save(entry);
    return entry;
  }

  /* ---- RAG Query ---- */

  async query(tenantId: string, question: string, kbIds?: string[]): Promise<RagResult> {
    const apiKey = await this.resolveApiKey(tenantId);
    const wkKbIds = await this.resolveWkKbIds(tenantId, kbIds);
    const sessionId = randomUUID();

    const result = await this.client.chat(apiKey, sessionId, {
      query: question,
      knowledge_base_ids: wkKbIds,
    });

    return {
      answer: result.answer || '',
      sources: (result.sources || []).map(this.mapSource),
    };
  }

  async queryStream(tenantId: string, question: string, kbIds?: string[]): Promise<Response> {
    const apiKey = await this.resolveApiKey(tenantId);
    const wkKbIds = await this.resolveWkKbIds(tenantId, kbIds);
    const sessionId = randomUUID();

    return this.client.chatStream(apiKey, sessionId, {
      query: question,
      knowledge_base_ids: wkKbIds,
    });
  }

  async agentQuery(tenantId: string, question: string, kbIds?: string[]): Promise<Response> {
    const apiKey = await this.resolveApiKey(tenantId);
    const wkKbIds = await this.resolveWkKbIds(tenantId, kbIds);
    const sessionId = randomUUID();

    return this.client.agentChat(apiKey, sessionId, {
      query: question,
      knowledge_base_ids: wkKbIds,
    });
  }

  /* ---- Search ---- */

  async search(
    tenantId: string,
    query: string,
    kbIds?: string[],
    opts?: { topK?: number; scoreThreshold?: number }
  ): Promise<SearchHit[]> {
    const apiKey = await this.resolveApiKey(tenantId);

    if (kbIds?.length) {
      const wkKbIds = await this.resolveWkKbIds(tenantId, kbIds);
      const results: WkSearchResult[] = [];
      for (const wkKbId of wkKbIds) {
        const hits = await this.client.hybridSearch(apiKey, wkKbId, query, {
          top_k: opts?.topK,
          score_threshold: opts?.scoreThreshold,
        });
        results.push(...hits);
      }
      return results.map(this.mapSearchHit);
    }

    const results = await this.client.crossKbSearch(apiKey, query);
    return results.map(this.mapSearchHit);
  }

  /* ---- Internals ---- */

  private async resolveApiKey(tenantId: string): Promise<string> {
    const mapping = await this.mappingRepo.getByHmrTenantId(tenantId);
    if (!mapping || mapping.status !== 'active') {
      throw new AppError('WeKnora not provisioned for this tenant', 404, 'WK_NOT_PROVISIONED');
    }
    return this.encryption.decrypt(mapping.wkApiKey);
  }

  private async resolveWkKbIds(tenantId: string, hmrKbIds?: string[]): Promise<string[]> {
    if (!hmrKbIds?.length) {
      const mapping = await this.mappingRepo.getByHmrTenantId(tenantId);
      return mapping?.defaultKbId ? [mapping.defaultKbId] : [];
    }
    const wkIds: string[] = [];
    for (const id of hmrKbIds) {
      const kb = await this.kbRepo.findById(id);
      if (kb && kb.tenantId === tenantId) {
        wkIds.push(kb.wkKnowledgeBaseId);
      }
    }
    return wkIds;
  }

  private mapSource(s: WkSearchResult): RagSource {
    return {
      knowledgeId: s.id || '',
      title: s.title || '',
      content: s.content || '',
      score: s.score || 0,
    };
  }

  private mapSearchHit(s: WkSearchResult): SearchHit {
    return {
      knowledgeId: s.id || '',
      title: s.title || '',
      content: s.content || '',
      score: s.score || 0,
      chunkId: s.chunk_id,
    };
  }
}
