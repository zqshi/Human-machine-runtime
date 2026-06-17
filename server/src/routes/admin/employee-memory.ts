import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { MemoryService } from '../../contexts/employee-memory/memory-service.js';
import {
  type FragmentScope,
  type RetrievalConfig,
  FRAGMENT_SCOPE,
  FRAGMENT_TYPE,
  RULE_TYPE,
} from '../../contexts/employee-memory/domain/memory.js';
import type { Principal } from '../../middleware/auth.js';

function getUser(c: Context): Principal {
  return c.get('user') as Principal;
}

/** 将 query 字符串过滤为枚举合法值，非法/缺失返回 undefined */
function queryEnum<T extends string>(c: Context, key: string, allowed: readonly T[]): T | undefined {
  const raw = c.req.query(key);
  return raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : undefined;
}

const createStoreSchema = z.object({
  instanceId: z.string().min(1),
  name: z.string().min(1).max(128),
  description: z.string().optional(),
  retrievalConfig: z.object({
    topK: z.number().min(1).max(50).optional(),
    scoreThreshold: z.number().min(0).max(1).optional(),
    maxMemoryAge: z.number().min(0).optional(),
    memoryTypes: z.array(z.string()).optional(),
    useKeywordSearch: z.boolean().optional(),
    useVectorSearch: z.boolean().optional(),
    keywordWeight: z.number().min(0).max(1).optional(),
    vectorWeight: z.number().min(0).max(1).optional(),
  }).optional(),
});

const addFragmentSchema = z.object({
  userId: z.string().min(1),
  scope: z.enum(['personal', 'org', 'dept_shared']).optional(),
  departmentId: z.string().optional(),
  type: z.enum(['preference', 'fact', 'interaction_summary', 'feedback']),
  content: z.string().min(1),
  source: z.enum(['auto_extracted', 'manual', 'rule_generated']).optional(),
  importance: z.number().min(1).max(10).optional(),
  expiresAt: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const createRuleSchema = z.object({
  ruleType: z.enum(['fragment_rule', 'profile_rule', 'consensus_rule']),
  name: z.string().min(1).max(128),
  description: z.string().optional(),
  trigger: z.object({
    event: z.string().optional(),
    conditions: z.record(z.unknown()).optional(),
  }).optional(),
  action: z.object({
    type: z.string().optional(),
    params: z.record(z.unknown()).optional(),
  }).optional(),
  priority: z.number().optional(),
  enabled: z.boolean().optional(),
});

const updateRuleSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  description: z.string().optional(),
  trigger: z.object({
    event: z.string().optional(),
    conditions: z.record(z.unknown()).optional(),
  }).optional(),
  action: z.object({
    type: z.string().optional(),
    params: z.record(z.unknown()).optional(),
  }).optional(),
  priority: z.number().optional(),
  enabled: z.boolean().optional(),
});

const searchSchema = z.object({
  query: z.string().min(1),
  userId: z.string().optional(),
  topK: z.number().min(1).max(50).optional(),
});

const updateRetrievalConfigSchema = z.object({
  topK: z.number().min(1).max(50).optional(),
  scoreThreshold: z.number().min(0).max(1).optional(),
  maxMemoryAge: z.number().min(0).optional(),
  memoryTypes: z.array(z.string()).optional(),
  useKeywordSearch: z.boolean().optional(),
  useVectorSearch: z.boolean().optional(),
  keywordWeight: z.number().min(0).max(1).optional(),
  vectorWeight: z.number().min(0).max(1).optional(),
});

export function createAdminMemoryRoutes(svc: MemoryService) {
  const app = new Hono();

  /* ──── Store CRUD ──── */

  app.get('/stores', async (c) => {
    const tenantId = c.req.query('tenantId');
    const instanceId = c.req.query('instanceId');
    if (instanceId) {
      const store = await svc.getStoreByInstance(instanceId);
      if (!store) return c.json([]);
      const stats = await svc.getStoreFragmentStats(store.id);
      return c.json([{ ...store, orgFragmentCount: stats.orgCount, personalFragmentCount: stats.personalCount }]);
    }
    const stores = await svc.listStores(tenantId || undefined);
    return c.json(stores);
  });

  app.post('/stores', async (c) => {
    const body = await c.req.json();
    const parsed = createStoreSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid input', details: parsed.error.flatten() }, 400);
    }
    const data = parsed.data;
    const user = getUser(c);
    try {
      const store = await svc.createStore({
        instanceId: data.instanceId,
        tenantId: user.tenantId || 'default',
        name: data.name,
        description: data.description,
        retrievalConfig: data.retrievalConfig as Partial<RetrievalConfig>,
      });
      return c.json(store, 201);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  app.get('/stores/:storeId', async (c) => {
    const store = await svc.getStoreById(c.req.param('storeId'));
    if (!store) return c.json({ error: 'not found' }, 404);
    const stats = await svc.getStoreFragmentStats(c.req.param('storeId'));
    return c.json({ ...store, orgFragmentCount: stats.orgCount, personalFragmentCount: stats.personalCount });
  });

  app.put('/stores/:storeId/retrieval-config', async (c) => {
    const body = await c.req.json();
    const parsed = updateRetrievalConfigSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid config', details: parsed.error.flatten() }, 400);
    }
    try {
      const store = await svc.updateStoreRetrievalConfig(
        c.req.param('storeId'),
        parsed.data as Partial<RetrievalConfig>
      );
      return c.json(store);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 404);
    }
  });

  app.delete('/stores/:storeId', async (c) => {
    try {
      await svc.deleteStore(c.req.param('storeId'));
      return c.json({ success: true });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 404);
    }
  });

  app.put('/stores/:storeId/status', async (c) => {
    const body = await c.req.json();
    const status = body?.status;
    if (status !== 'active' && status !== 'archived') {
      return c.json({ error: 'invalid status, must be active or archived' }, 400);
    }
    try {
      const store = status === 'archived'
        ? await svc.archiveStore(c.req.param('storeId'))
        : await svc.restoreStore(c.req.param('storeId'));
      return c.json(store);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 404);
    }
  });

  /* ──── Fragment CRUD ──── */

  app.get('/stores/:storeId/fragments', async (c) => {
    const storeId = c.req.param('storeId');
    const userId = c.req.query('userId');
    const type = queryEnum(c, 'type', Object.values(FRAGMENT_TYPE));
    const keyword = c.req.query('keyword');
    const scope = queryEnum(c, 'scope', Object.values(FRAGMENT_SCOPE)) as
      | FragmentScope
      | undefined;
    const departmentId = c.req.query('departmentId') || undefined;
    const limit = c.req.query('limit') ? Number(c.req.query('limit')) : undefined;
    const offset = c.req.query('offset') ? Number(c.req.query('offset')) : undefined;
    const fragments = await svc.listFragments(storeId, { userId, type, keyword, limit, offset, scope, departmentId });
    return c.json(fragments);
  });

  app.post('/stores/:storeId/fragments', async (c) => {
    const storeId = c.req.param('storeId');
    const body = await c.req.json();
    const parsed = addFragmentSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid fragment', details: parsed.error.flatten() }, 400);
    }
    const data = parsed.data;
    const user = getUser(c);
    try {
      // 部门级跨 Agent 共享走专用路径（挂 Mem0 app entity）
      if (data.scope === 'dept_shared') {
        if (!data.departmentId) {
          return c.json({ error: 'departmentId is required for dept_shared scope' }, 400);
        }
        const fragment = await svc.addDeptSharedFragment({
          storeId,
          departmentId: data.departmentId,
          content: data.content,
          type: data.type,
          importance: data.importance,
          metadata: data.metadata,
        });
        return c.json(fragment, 201);
      }
      const fragment = await svc.addFragment({
        storeId,
        tenantId: user.tenantId || 'default',
        userId: data.userId,
        scope: data.scope,
        departmentId: data.departmentId,
        type: data.type,
        content: data.content,
        source: data.source,
        importance: data.importance,
        expiresAt: data.expiresAt,
        metadata: data.metadata,
      });
      return c.json(fragment, 201);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  // 语义别名：部门级跨 Agent 共享记忆
  app.post('/stores/:storeId/dept-fragments', async (c) => {
    const storeId = c.req.param('storeId');
    const body = await c.req.json();
    const parsed = z.object({
      departmentId: z.string().min(1),
      content: z.string().min(1),
      type: z.enum(['preference', 'fact', 'interaction_summary', 'feedback']).optional(),
      importance: z.number().min(1).max(10).optional(),
      metadata: z.record(z.unknown()).optional(),
    }).safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid dept fragment', details: parsed.error.flatten() }, 400);
    }
    try {
      const fragment = await svc.addDeptSharedFragment({
        storeId,
        departmentId: parsed.data.departmentId,
        content: parsed.data.content,
        type: parsed.data.type,
        importance: parsed.data.importance,
        metadata: parsed.data.metadata,
      });
      return c.json(fragment, 201);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  app.delete('/stores/:storeId/fragments/:fragmentId', async (c) => {
    try {
      await svc.deleteFragment(c.req.param('fragmentId'));
      return c.json({ success: true });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 404);
    }
  });

  /* ──── Rule CRUD ──── */

  app.get('/stores/:storeId/rules', async (c) => {
    const storeId = c.req.param('storeId');
    const ruleType = queryEnum(c, 'ruleType', Object.values(RULE_TYPE));
    const rules = await svc.listRules(storeId, { ruleType });
    return c.json(rules);
  });

  app.post('/stores/:storeId/rules', async (c) => {
    const storeId = c.req.param('storeId');
    const body = await c.req.json();
    const parsed = createRuleSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid rule', details: parsed.error.flatten() }, 400);
    }
    const data = parsed.data;
    const user = getUser(c);
    try {
      const rule = await svc.createRule({
        storeId,
        tenantId: user.tenantId || 'default',
        ruleType: data.ruleType,
        name: data.name,
        description: data.description,
        trigger: data.trigger,
        action: data.action,
        priority: data.priority,
        enabled: data.enabled,
      });
      return c.json(rule, 201);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  app.put('/stores/:storeId/rules/:ruleId', async (c) => {
    const body = await c.req.json();
    const parsed = updateRuleSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid update', details: parsed.error.flatten() }, 400);
    }
    try {
      const rule = await svc.updateRule(c.req.param('ruleId'), parsed.data);
      return c.json(rule);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 404);
    }
  });

  app.delete('/stores/:storeId/rules/:ruleId', async (c) => {
    try {
      await svc.deleteRule(c.req.param('ruleId'));
      return c.json({ success: true });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 404);
    }
  });

  /* ──── Search & Verify ──── */

  app.post('/stores/:storeId/search', async (c) => {
    const body = await c.req.json();
    const parsed = searchSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid search', details: parsed.error.flatten() }, 400);
    }
    const data = parsed.data;
    try {
      const result = await svc.search(c.req.param('storeId'), data.query, {
        userId: data.userId,
        topK: data.topK,
      });
      return c.json(result);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 404);
    }
  });

  app.post('/stores/:storeId/verify', async (c) => {
    const body = await c.req.json();
    const parsed = searchSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'invalid verify request', details: parsed.error.flatten() }, 400);
    }
    const data = parsed.data;
    try {
      const result = await svc.verifyRetrieval(c.req.param('storeId'), data.query, {
        userId: data.userId,
        topK: data.topK,
      });
      return c.json(result);
    } catch (err) {
      return c.json({ error: (err as Error).message }, 404);
    }
  });

  return app;
}
