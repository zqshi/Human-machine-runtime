import { describe, it, expect } from 'vitest';
import {
  createKnowledgeBase,
  updateKnowledgeBase,
  archiveKnowledgeBase,
  bindInstances,
  unbindInstances,
  validateChunkingConfig,
  validateRetrievalConfig,
  KB_STATUS,
  KB_TYPE,
} from './knowledge.js';

describe('createKnowledgeBase', () => {
  const base = {
    tenantId: 'tn_abc',
    name: '测试知识库',
  };

  it('creates with defaults', () => {
    const kb = createKnowledgeBase(base, 'wk-123');
    expect(kb.id).toMatch(/^kb_/);
    expect(kb.tenantId).toBe('tn_abc');
    expect(kb.wkKnowledgeBaseId).toBe('wk-123');
    expect(kb.name).toBe('测试知识库');
    expect(kb.type).toBe(KB_TYPE.DOCUMENT);
    expect(kb.status).toBe(KB_STATUS.ACTIVE);
    expect(kb.chunkingConfig.chunkSize).toBe(512);
    expect(kb.retrievalConfig.topK).toBe(5);
    expect(kb.boundInstanceIds).toEqual([]);
  });

  it('rejects empty name', () => {
    expect(() => createKnowledgeBase({ ...base, name: '' }, 'wk-1')).toThrow(
      'knowledge base name is required'
    );
  });

  it('rejects name > 128 chars', () => {
    expect(() => createKnowledgeBase({ ...base, name: 'a'.repeat(129) }, 'wk-1')).toThrow(
      'max 128'
    );
  });

  it('uses specified type', () => {
    const kb = createKnowledgeBase({ ...base, type: 'faq' }, 'wk-1');
    expect(kb.type).toBe(KB_TYPE.FAQ);
  });

  it('falls back to document for invalid type', () => {
    const kb = createKnowledgeBase({ ...base, type: 'invalid' as never }, 'wk-1');
    expect(kb.type).toBe(KB_TYPE.DOCUMENT);
  });

  it('merges chunking config', () => {
    const kb = createKnowledgeBase({ ...base, chunkingConfig: { chunkSize: 1024 } }, 'wk-1');
    expect(kb.chunkingConfig.chunkSize).toBe(1024);
    expect(kb.chunkingConfig.chunkOverlap).toBe(64);
  });

  it('merges retrieval config', () => {
    const kb = createKnowledgeBase(
      { ...base, retrievalConfig: { topK: 10, bm25Weight: 0.5 } },
      'wk-1'
    );
    expect(kb.retrievalConfig.topK).toBe(10);
    expect(kb.retrievalConfig.bm25Weight).toBe(0.5);
    expect(kb.retrievalConfig.vectorWeight).toBe(0.7);
  });
});

describe('updateKnowledgeBase', () => {
  const kb = createKnowledgeBase({ tenantId: 'tn_1', name: '原名' }, 'wk-1');

  it('updates name', () => {
    const updated = updateKnowledgeBase(kb, { name: '新名' });
    expect(updated.name).toBe('新名');
    expect(updated.updatedAt).not.toBe(kb.updatedAt);
  });

  it('rejects empty name', () => {
    expect(() => updateKnowledgeBase(kb, { name: '' })).toThrow('cannot be empty');
  });

  it('merges chunking config', () => {
    const updated = updateKnowledgeBase(kb, {
      chunkingConfig: { chunkSize: 256, chunkOverlap: 32 },
    });
    expect(updated.chunkingConfig.chunkSize).toBe(256);
    expect(updated.chunkingConfig.chunkOverlap).toBe(32);
  });

  it('preserves unchanged fields', () => {
    const updated = updateKnowledgeBase(kb, { description: '新描述' });
    expect(updated.name).toBe('原名');
    expect(updated.description).toBe('新描述');
  });
});

describe('archiveKnowledgeBase', () => {
  it('archives active KB', () => {
    const kb = createKnowledgeBase({ tenantId: 'tn_1', name: 'test' }, 'wk-1');
    const archived = archiveKnowledgeBase(kb);
    expect(archived.status).toBe(KB_STATUS.ARCHIVED);
  });

  it('rejects already archived', () => {
    const kb = createKnowledgeBase({ tenantId: 'tn_1', name: 'test' }, 'wk-1');
    const archived = archiveKnowledgeBase(kb);
    expect(() => archiveKnowledgeBase(archived)).toThrow('already archived');
  });
});

describe('bindInstances / unbindInstances', () => {
  const kb = createKnowledgeBase({ tenantId: 'tn_1', name: 'test' }, 'wk-1');

  it('binds instances', () => {
    const bound = bindInstances(kb, ['inst_1', 'inst_2']);
    expect(bound.boundInstanceIds).toEqual(['inst_1', 'inst_2']);
  });

  it('deduplicates bindings', () => {
    const first = bindInstances(kb, ['inst_1']);
    const second = bindInstances(first, ['inst_1', 'inst_2']);
    expect(second.boundInstanceIds).toEqual(['inst_1', 'inst_2']);
  });

  it('unbinds instances', () => {
    const bound = bindInstances(kb, ['inst_1', 'inst_2', 'inst_3']);
    const unbound = unbindInstances(bound, ['inst_2']);
    expect(unbound.boundInstanceIds).toEqual(['inst_1', 'inst_3']);
  });
});

describe('validateChunkingConfig', () => {
  it('accepts valid config', () => {
    expect(validateChunkingConfig({ chunkSize: 512, chunkOverlap: 64 })).toBeNull();
  });

  it('rejects chunkSize < 64', () => {
    expect(validateChunkingConfig({ chunkSize: 32 })).toContain('64 and 4096');
  });

  it('rejects chunkSize > 4096', () => {
    expect(validateChunkingConfig({ chunkSize: 5000 })).toContain('64 and 4096');
  });

  it('rejects overlap >= chunkSize', () => {
    expect(validateChunkingConfig({ chunkSize: 256, chunkOverlap: 300 })).toContain(
      'less than chunkSize'
    );
  });
});

describe('validateRetrievalConfig', () => {
  it('accepts valid config', () => {
    expect(validateRetrievalConfig({ topK: 10, scoreThreshold: 0.5 })).toBeNull();
  });

  it('rejects topK < 1', () => {
    expect(validateRetrievalConfig({ topK: 0 })).toContain('1 and 50');
  });

  it('rejects scoreThreshold > 1', () => {
    expect(validateRetrievalConfig({ scoreThreshold: 1.5 })).toContain('0 and 1');
  });

  it('rejects bm25Weight < 0', () => {
    expect(validateRetrievalConfig({ bm25Weight: -0.1 })).toContain('0 and 1');
  });
});
