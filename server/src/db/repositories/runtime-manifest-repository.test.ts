import { describe, it, expect, vi } from 'vitest';
import { RuntimeManifestRepository } from './runtime-manifest-repository.js';

/**
 * runtime-manifest-repository 集成测试(C2)。
 * mock Database(Drizzle db 对象):链式方法 where/orderBy/limit/offset/values/set/from/returning
 * 均 thenable(await 得配置的 rows)。照 credential-repository.test.ts 模式。
 * 不验证 drizzle 操作符(eq/and/desc)内部结构,只验证 db 调用结构 + row→domain 映射 + 不可变约束。
 */

function makeChain(rows: unknown[] = []) {
  const chain: Record<string, ReturnType<typeof vi.fn>> & { then?: unknown } = {};
  for (const m of ['where', 'orderBy', 'limit', 'offset', 'values', 'set', 'from', 'returning']) {
    chain[m] = vi.fn(() => chain);
  }
  chain.then = (resolve: (v: unknown[]) => unknown) => Promise.resolve(rows).then(resolve);
  return chain;
}

interface MockDbOpts {
  selectReturn?: unknown[];
  insertReturn?: unknown[];
  updateReturn?: unknown[];
}

function makeMockDb(opts: MockDbOpts = {}) {
  return {
    insert: vi.fn(() => makeChain(opts.insertReturn ?? [])),
    select: vi.fn(() => makeChain(opts.selectReturn ?? [])),
    update: vi.fn(() => makeChain(opts.updateReturn ?? [])),
    delete: vi.fn(() => makeChain()),
  };
}

const BAKED_MANIFEST_ROW = {
  id: 'rman_1',
  agentDefinitionId: 'adef_1',
  generation: 1,
  manifest: {
    id: 'rman_1',
    agentDefinitionId: 'adef_1',
    generation: 1,
    bakedAt: 1782570725921,
    status: 'baked',
    compiledSystemPrompt: '你是助手',
    compiledGuardrails: [],
    compiledTools: [],
    compiledSkillsContext: '',
    compiledQuota: {},
    refusalResponse: '',
    runtimeRoute: 'tool-loop',
    sandboxStrategy: 'opensandbox',
    errorMsg: null,
  },
  status: 'baked',
  bakedAt: new Date('2026-06-28T00:00:00Z'),
  errorMsg: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('RuntimeManifestRepository — findBakedManifest', () => {
  it('查到 baked 行 → 返回 RuntimeManifest(domain 反序列化)', async () => {
    const db = makeMockDb({ selectReturn: [BAKED_MANIFEST_ROW] });
    const repo = new RuntimeManifestRepository(db as never);
    const m = await repo.findBakedManifest('adef_1', 1);
    expect(m).not.toBeNull();
    expect(m!.compiledSystemPrompt).toBe('你是助手');
    expect(m!.runtimeRoute).toBe('tool-loop');
  });

  it('无行 → 返回 null', async () => {
    const db = makeMockDb({ selectReturn: [] });
    const repo = new RuntimeManifestRepository(db as never);
    const m = await repo.findBakedManifest('adef_1', 1);
    expect(m).toBeNull();
  });
});

describe('RuntimeManifestRepository — findManifest', () => {
  it('查到 baked 行 → 返回 manifest', async () => {
    const db = makeMockDb({ selectReturn: [BAKED_MANIFEST_ROW] });
    const repo = new RuntimeManifestRepository(db as never);
    const m = await repo.findManifest('adef_1', 1);
    expect(m).not.toBeNull();
    expect(m!.status).toBe('baked');
  });

  it('查到非 baked 行 → mapRow 返回 null(只认 baked)', async () => {
    const db = makeMockDb({
      selectReturn: [{ ...BAKED_MANIFEST_ROW, status: 'pending' }],
    });
    const repo = new RuntimeManifestRepository(db as never);
    const m = await repo.findManifest('adef_1', 1);
    expect(m).toBeNull();
  });
});

describe('RuntimeManifestRepository — upsertPending', () => {
  it('无现有 → 新建 pending 占位(insert 调用)', async () => {
    const db = makeMockDb({ selectReturn: [] });
    const repo = new RuntimeManifestRepository(db as never);
    await repo.upsertPending('rman_1', 'adef_1', 1);
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(db.update).not.toHaveBeenCalled();
  });

  it('现有 baked → 抛错(已固化不可重建)', async () => {
    const db = makeMockDb({ selectReturn: [BAKED_MANIFEST_ROW] });
    const repo = new RuntimeManifestRepository(db as never);
    await expect(repo.upsertPending('rman_1', 'adef_1', 1)).rejects.toThrow('already baked');
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('现有 failed → 重置为 pending(update 调用,不 insert)', async () => {
    const db = makeMockDb({
      selectReturn: [{ ...BAKED_MANIFEST_ROW, status: 'failed' }],
    });
    const repo = new RuntimeManifestRepository(db as never);
    await repo.upsertPending('rman_1', 'adef_1', 1);
    expect(db.update).toHaveBeenCalledTimes(1);
    expect(db.insert).not.toHaveBeenCalled();
  });
});

describe('RuntimeManifestRepository — saveBaked', () => {
  it('写 manifest jsonb + status=baked + bakedAt', async () => {
    const db = makeMockDb();
    const repo = new RuntimeManifestRepository(db as never);
    await repo.saveBaked('rman_1', BAKED_MANIFEST_ROW.manifest as never);
    expect(db.update).toHaveBeenCalledTimes(1);
  });
});

describe('RuntimeManifestRepository — saveFailed', () => {
  it('写 status=failed + errorMsg(不碰 manifest)', async () => {
    const db = makeMockDb();
    const repo = new RuntimeManifestRepository(db as never);
    await repo.saveFailed('rman_1', '解析工具失败');
    expect(db.update).toHaveBeenCalledTimes(1);
  });
});

describe('RuntimeManifestRepository — updateStatus', () => {
  it('baked → expired 合法流转', async () => {
    const db = makeMockDb({
      selectReturn: [{ status: 'baked' }],
    });
    const repo = new RuntimeManifestRepository(db as never);
    await repo.updateStatus('rman_1', 'expired');
    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it('baked → pending 非法流转 → 抛错(已固化不可回退)', async () => {
    const db = makeMockDb({
      selectReturn: [{ status: 'baked' }],
    });
    const repo = new RuntimeManifestRepository(db as never);
    await expect(repo.updateStatus('rman_1', 'pending')).rejects.toThrow(
      'illegal status transition'
    );
    expect(db.update).not.toHaveBeenCalled();
  });

  it('manifest 不存在 → 抛错', async () => {
    const db = makeMockDb({ selectReturn: [] });
    const repo = new RuntimeManifestRepository(db as never);
    await expect(repo.updateStatus('rman_1', 'expired')).rejects.toThrow('not found');
  });
});

describe('RuntimeManifestRepository — listByDefinition', () => {
  it('返回该定义全部 baked manifest(generation 倒序)', async () => {
    const row2 = { ...BAKED_MANIFEST_ROW, id: 'rman_2', generation: 2 };
    const row1 = { ...BAKED_MANIFEST_ROW, id: 'rman_1', generation: 1 };
    const db = makeMockDb({ selectReturn: [row2, row1] });
    const repo = new RuntimeManifestRepository(db as never);
    const list = await repo.listByDefinition('adef_1');
    expect(list).toHaveLength(2);
    expect(list[0].generation).toBe(2);
  });
});
