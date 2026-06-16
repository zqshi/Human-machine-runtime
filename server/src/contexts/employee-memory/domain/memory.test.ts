import { describe, it, expect } from 'vitest';
import {
  createMemoryStore,
  createMemoryFragment,
  createMemoryRule,
  validateRetrievalConfig,
  validateRuleTrigger,
  type RetrievalConfig,
} from './memory.js';

/* ──── MemoryStore ──── */

describe('createMemoryStore', () => {
  it('creates a store with defaults', () => {
    const store = createMemoryStore({
      instanceId: 'inst_1',
      tenantId: 'tn_1',
      name: 'Test Memory Store',
    });
    expect(store.id).toMatch(/^mem_/);
    expect(store.instanceId).toBe('inst_1');
    expect(store.tenantId).toBe('tn_1');
    expect(store.name).toBe('Test Memory Store');
    expect(store.status).toBe('active');
    expect(store.totalFragments).toBe(0);
    expect(store.totalProfiles).toBe(0);
    expect(store.retrievalConfig.topK).toBe(5);
    expect(store.retrievalConfig.useKeywordSearch).toBe(true);
    expect(store.retrievalConfig.useVectorSearch).toBe(false);
    expect(store.retrievalConfig.keywordWeight).toBe(0.4);
    expect(store.retrievalConfig.vectorWeight).toBe(0.6);
  });

  it('overrides retrieval config', () => {
    const store = createMemoryStore({
      instanceId: 'inst_1',
      tenantId: 'tn_1',
      name: 'Test',
      retrievalConfig: { topK: 10, useVectorSearch: true },
    });
    expect(store.retrievalConfig.topK).toBe(10);
    expect(store.retrievalConfig.useVectorSearch).toBe(true);
    expect(store.retrievalConfig.useKeywordSearch).toBe(true); // keeps default
  });

  it('throws on empty name', () => {
    expect(() =>
      createMemoryStore({ instanceId: 'i', tenantId: 't', name: '' })
    ).toThrow('memory store name is required');
  });

  it('throws on name too long', () => {
    expect(() =>
      createMemoryStore({ instanceId: 'i', tenantId: 't', name: 'x'.repeat(129) })
    ).toThrow('max 128 chars');
  });

  it('trims whitespace from name', () => {
    const store = createMemoryStore({ instanceId: 'i', tenantId: 't', name: '  hello  ' });
    expect(store.name).toBe('hello');
  });
});

/* ──── MemoryFragment ──── */

describe('createMemoryFragment', () => {
  it('creates a fragment with defaults', () => {
    const frag = createMemoryFragment({
      memoryStoreId: 'mem_1',
      tenantId: 'tn_1',
      userId: 'user_1',
      type: 'fact',
      content: 'User prefers dark mode',
    });
    expect(frag.id).toMatch(/^mf_/);
    expect(frag.memoryStoreId).toBe('mem_1');
    expect(frag.userId).toBe('user_1');
    expect(frag.type).toBe('fact');
    expect(frag.content).toBe('User prefers dark mode');
    expect(frag.source).toBe('manual');
    expect(frag.importance).toBe(5);
    expect(frag.accessCount).toBe(0);
    expect(frag.expiresAt).toBeNull();
  });

  it('creates with all options', () => {
    const frag = createMemoryFragment({
      memoryStoreId: 'mem_1',
      tenantId: 'tn_1',
      userId: 'user_1',
      type: 'preference',
      content: 'Likes concise answers',
      source: 'auto_extracted',
      importance: 8,
      expiresAt: '2026-12-31T00:00:00Z',
      metadata: { sourceConversation: 'conv_1' },
    });
    expect(frag.source).toBe('auto_extracted');
    expect(frag.importance).toBe(8);
    expect(frag.expiresAt).toBe('2026-12-31T00:00:00Z');
    expect(frag.metadata).toEqual({ sourceConversation: 'conv_1' });
  });

  it('throws on empty content', () => {
    expect(() =>
      createMemoryFragment({
        memoryStoreId: 'm', tenantId: 't', userId: 'u', type: 'fact', content: '',
      })
    ).toThrow('fragment content is required');
  });

  it('throws on empty userId', () => {
    expect(() =>
      createMemoryFragment({
        memoryStoreId: 'm', tenantId: 't', userId: '', type: 'fact', content: 'hello',
      })
    ).toThrow('fragment userId is required');
  });

  it('throws on invalid type', () => {
    expect(() =>
      createMemoryFragment({
        memoryStoreId: 'm', tenantId: 't', userId: 'u', type: 'invalid' as any, content: 'hello',
      })
    ).toThrow('invalid fragment type');
  });

  it('throws on importance out of range', () => {
    expect(() =>
      createMemoryFragment({
        memoryStoreId: 'm', tenantId: 't', userId: 'u', type: 'fact', content: 'x', importance: 0,
      })
    ).toThrow('between 1 and 10');
    expect(() =>
      createMemoryFragment({
        memoryStoreId: 'm', tenantId: 't', userId: 'u', type: 'fact', content: 'x', importance: 11,
      })
    ).toThrow('between 1 and 10');
  });
});

/* ──── MemoryRule ──── */

describe('createMemoryRule', () => {
  it('creates a fragment rule with defaults', () => {
    const rule = createMemoryRule({
      memoryStoreId: 'mem_1',
      tenantId: 'tn_1',
      ruleType: 'fragment_rule',
      name: 'Extract preference on feedback',
    });
    expect(rule.id).toMatch(/^mr_/);
    expect(rule.ruleType).toBe('fragment_rule');
    expect(rule.name).toBe('Extract preference on feedback');
    expect(rule.priority).toBe(0);
    expect(rule.enabled).toBe(true);
    expect(rule.trigger).toEqual({});
    expect(rule.action).toEqual({});
  });

  it('creates a profile rule with options', () => {
    const rule = createMemoryRule({
      memoryStoreId: 'mem_1',
      tenantId: 'tn_1',
      ruleType: 'profile_rule',
      name: 'Update user profile',
      trigger: { event: 'conversation_end', conditions: { minTurns: 3 } },
      action: { type: 'update_profile', params: { fields: ['department', 'role'] } },
      priority: 10,
      enabled: false,
    });
    expect(rule.ruleType).toBe('profile_rule');
    expect(rule.trigger.event).toBe('conversation_end');
    expect(rule.action.type).toBe('update_profile');
    expect(rule.priority).toBe(10);
    expect(rule.enabled).toBe(false);
  });

  it('throws on empty name', () => {
    expect(() =>
      createMemoryRule({ memoryStoreId: 'm', tenantId: 't', ruleType: 'fragment_rule', name: '' })
    ).toThrow('rule name is required');
  });

  it('throws on invalid ruleType', () => {
    expect(() =>
      createMemoryRule({ memoryStoreId: 'm', tenantId: 't', ruleType: 'invalid' as any, name: 'x' })
    ).toThrow('invalid rule type');
  });
});

/* ──── Validation ──── */

describe('validateRetrievalConfig', () => {
  it('returns null for valid config', () => {
    expect(validateRetrievalConfig({ topK: 5, scoreThreshold: 0.5 })).toBeNull();
  });

  it('rejects topK out of range', () => {
    expect(validateRetrievalConfig({ topK: 0 })).toBe('topK must be between 1 and 50');
    expect(validateRetrievalConfig({ topK: 51 })).toBe('topK must be between 1 and 50');
  });

  it('rejects scoreThreshold out of range', () => {
    expect(validateRetrievalConfig({ scoreThreshold: -0.1 })).toBe('scoreThreshold must be between 0 and 1');
    expect(validateRetrievalConfig({ scoreThreshold: 1.1 })).toBe('scoreThreshold must be between 0 and 1');
  });

  it('rejects both channels disabled', () => {
    expect(
      validateRetrievalConfig({ useKeywordSearch: false, useVectorSearch: false })
    ).toBe('at least one search channel must be enabled');
  });

  it('rejects weight out of range', () => {
    expect(validateRetrievalConfig({ keywordWeight: -0.1 })).toBe('keywordWeight must be between 0 and 1');
    expect(validateRetrievalConfig({ vectorWeight: 1.5 })).toBe('vectorWeight must be between 0 and 1');
  });
});

describe('validateRuleTrigger', () => {
  it('returns null for valid event', () => {
    expect(validateRuleTrigger({ event: 'message_sent' })).toBeNull();
    expect(validateRuleTrigger({ event: 'conversation_end' })).toBeNull();
  });

  it('returns null for empty trigger', () => {
    expect(validateRuleTrigger({})).toBeNull();
  });

  it('rejects invalid event', () => {
    expect(validateRuleTrigger({ event: 'invalid' })).toBe('invalid trigger event: invalid');
  });
});
