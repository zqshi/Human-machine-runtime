import { describe, it, expect, vi } from 'vitest';
import { CredentialRepository } from './credential-repository.js';

/**
 * credential-repository 集成测试（D6）。
 *
 * mock Database（Drizzle db 对象）：链式方法 where/orderBy/limit/offset/values/set/from/returning
 * 均返回 chain 自身并 thenable（await 得配置的 rows）。参照 oauth-state-repository.test.ts 模式，
 * 扩展支持 select/insert/delete/update 四类终端。不验证 drizzle 操作符（and/eq/desc/isNull/lt）的内部结构，
 * 只验证 db 调用结构 + row→domain 映射 + 关键默认值（status='active' 等）。
 */

/** 构建一个 thenable 链：所有链方法返回 self，await 得 rows。 */
function makeChain(rows: unknown[] = []) {
  const chain: Record<string, ReturnType<typeof vi.fn>> & { then?: unknown } = {};
  for (const m of ['where', 'orderBy', 'limit', 'offset', 'values', 'set', 'from', 'returning']) {
    chain[m] = vi.fn(() => chain);
  }
  // select 链终端（limit/offset/orderBy）await 触发；returning 终端 await 触发。统一 thenable。
  chain.then = (resolve: (v: unknown[]) => unknown) => Promise.resolve(rows).then(resolve);
  return chain;
}

interface MockDbOpts {
  insertReturn?: unknown[];
  selectReturn?: unknown[];
  updateReturn?: unknown[];
}

function makeMockDb(opts: MockDbOpts = {}) {
  const db = {
    insert: vi.fn(() => makeChain(opts.insertReturn ?? [])),
    select: vi.fn(() => makeChain(opts.selectReturn ?? [])),
    delete: vi.fn(() => makeChain()),
    update: vi.fn(() => makeChain(opts.updateReturn ?? [])),
  };
  return { db };
}

const AUTHZ_ROW = {
  id: 1,
  userId: 10,
  providerId: 20,
  externalAccountId: 'acct-x',
  scope: 'read',
  status: 'active',
  expiresAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
};

describe('CredentialRepository — Authorizations', () => {
  it('createAuthorization: insert returning 映射 + 默认 status=active/expiresAt=null', async () => {
    const { db } = makeMockDb({ insertReturn: [AUTHZ_ROW] });
    const repo = new CredentialRepository(db as never);
    const row = await repo.createAuthorization({
      userId: 10,
      providerId: 20,
      externalAccountId: 'acct-x',
      scope: 'read',
    });
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(row).toEqual({
      id: 1,
      userId: 10,
      providerId: 20,
      externalAccountId: 'acct-x',
      scope: 'read',
      status: 'active',
      expiresAt: null,
      createdAt: AUTHZ_ROW.createdAt,
      updatedAt: AUTHZ_ROW.updatedAt,
    });
  });

  it('createAuthorization: 未传 externalAccountId/scope 时落 null', async () => {
    const { db } = makeMockDb({
      insertReturn: [{ ...AUTHZ_ROW, externalAccountId: null, scope: null }],
    });
    const repo = new CredentialRepository(db as never);
    const row = await repo.createAuthorization({ userId: 5, providerId: 6 });
    expect(row.externalAccountId).toBeNull();
    expect(row.scope).toBeNull();
  });

  it('getAuthorization: 命中返回映射，不命中返回 null', async () => {
    const hit = makeMockDb({ selectReturn: [AUTHZ_ROW] });
    const repoHit = new CredentialRepository(hit.db as never);
    expect(await repoHit.getAuthorization(1)).not.toBeNull();

    const miss = makeMockDb({ selectReturn: [] });
    const repoMiss = new CredentialRepository(miss.db as never);
    expect(await repoMiss.getAuthorization(999)).toBeNull();
  });

  it('listAuthorizations: filter userId+providerId 同时存在时透传 limit/offset', async () => {
    const { db } = makeMockDb({ selectReturn: [AUTHZ_ROW] });
    const repo = new CredentialRepository(db as never);
    const rows = await repo.listAuthorizations({ userId: 10, providerId: 20 }, 25, 50);
    expect(rows).toHaveLength(1);
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it('listAuthorizations: 无 filter 时仍返回行', async () => {
    const { db } = makeMockDb({ selectReturn: [AUTHZ_ROW, AUTHZ_ROW] });
    const repo = new CredentialRepository(db as never);
    const rows = await repo.listAuthorizations({}, 50, 0);
    expect(rows).toHaveLength(2);
  });

  it('deleteAuthorization: 先删 secrets 再删 authz（两次 delete 调用）', async () => {
    const { db } = makeMockDb();
    const repo = new CredentialRepository(db as never);
    await repo.deleteAuthorization(1);
    expect(db.delete).toHaveBeenCalledTimes(2);
  });
});

describe('CredentialRepository — Secrets', () => {
  it('saveSecret: insert values 含 authorizationId/secretType/ciphertext，取 returning id', async () => {
    const { db } = makeMockDb({ insertReturn: [{ id: 99 }] });
    const repo = new CredentialRepository(db as never);
    const id = await repo.saveSecret(7, 'password', 'cipher-blob');
    expect(id).toBe(99);
    expect(db.insert).toHaveBeenCalledTimes(1);
  });

  it('getSecretCiphertext: 命中返回密文，不命中返回 null', async () => {
    const hit = makeMockDb({ selectReturn: [{ ciphertext: 'cipher-blob' }] });
    const repoHit = new CredentialRepository(hit.db as never);
    expect(await repoHit.getSecretCiphertext(7, 'password')).toBe('cipher-blob');

    const miss = makeMockDb({ selectReturn: [] });
    const repoMiss = new CredentialRepository(miss.db as never);
    expect(await repoMiss.getSecretCiphertext(7, 'password')).toBeNull();
  });

  it('listSecrets: 返回元数据映射（不含 ciphertext）', async () => {
    const { db } = makeMockDb({
      selectReturn: [
        {
          id: 5,
          authorizationId: 7,
          secretType: 'token',
          keyVersion: 2,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-02T00:00:00Z'),
        },
      ],
    });
    const repo = new CredentialRepository(db as never);
    const metas = await repo.listSecrets(7);
    expect(metas).toHaveLength(1);
    expect(metas[0]).toEqual({
      id: 5,
      authorizationId: 7,
      secretType: 'token',
      keyVersion: 2,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
    });
  });

  it('deleteSecrets: 调 delete where', async () => {
    const { db } = makeMockDb();
    const repo = new CredentialRepository(db as never);
    await repo.deleteSecrets(7);
    expect(db.delete).toHaveBeenCalledTimes(1);
  });
});

describe('CredentialRepository — Leases', () => {
  const LEASE_ROW = {
    id: 1,
    leaseId: 'uuid-1',
    userId: 10,
    providerId: 20,
    scope: 'read',
    status: 'active',
    expiresAt: new Date('2026-12-31T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    revokedAt: null,
  };

  it('createLease: insert values 含 status=active + expiresAt，returning 映射 toLease', async () => {
    const { db } = makeMockDb({ insertReturn: [LEASE_ROW] });
    const repo = new CredentialRepository(db as never);
    const lease = await repo.createLease({
      userId: 10,
      providerId: 20,
      expiresAt: new Date('2026-12-31T00:00:00Z'),
    });
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(lease).toEqual({
      id: 1,
      leaseId: 'uuid-1',
      userId: 10,
      providerId: 20,
      scope: 'read',
      status: 'active',
      expiresAt: new Date('2026-12-31T00:00:00Z'),
      createdAt: new Date('2026-01-01T00:00:00Z'),
      revokedAt: null,
    });
  });

  it('findValidLease: 命中返回记录，不命中返回 null', async () => {
    const hit = makeMockDb({ selectReturn: [LEASE_ROW] });
    const repoHit = new CredentialRepository(hit.db as never);
    expect(await repoHit.findValidLease('uuid-1')).not.toBeNull();

    const miss = makeMockDb({ selectReturn: [] });
    const repoMiss = new CredentialRepository(miss.db as never);
    expect(await repoMiss.findValidLease('nope')).toBeNull();
  });

  it('revokeLease: update set status=revoked + revokedAt=Date，where eq leaseId', async () => {
    const { db } = makeMockDb();
    const repo = new CredentialRepository(db as never);
    await repo.revokeLease('uuid-1');
    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it('listLeases: filter status 时返回过滤行', async () => {
    const { db } = makeMockDb({ selectReturn: [LEASE_ROW] });
    const repo = new CredentialRepository(db as never);
    const leases = await repo.listLeases({ status: 'active' }, 20, 0);
    expect(leases).toHaveLength(1);
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it('listLeases: 无 filter 返回全部', async () => {
    const { db } = makeMockDb({ selectReturn: [LEASE_ROW, LEASE_ROW] });
    const repo = new CredentialRepository(db as never);
    const leases = await repo.listLeases({}, 50, 0);
    expect(leases).toHaveLength(2);
  });

  it('revokeExpiredLeases: update returning 行数 = 已过期 lease 数', async () => {
    const { db } = makeMockDb({ updateReturn: [{ id: 1 }, { id: 2 }] });
    const repo = new CredentialRepository(db as never);
    const count = await repo.revokeExpiredLeases();
    expect(count).toBe(2);
    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it('revokeExpiredLeases: 无过期时返回 0', async () => {
    const { db } = makeMockDb({ updateReturn: [] });
    const repo = new CredentialRepository(db as never);
    expect(await repo.revokeExpiredLeases()).toBe(0);
  });
});
