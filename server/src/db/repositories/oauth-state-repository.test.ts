import { describe, it, expect, vi } from 'vitest';
import { DbOAuthStateRepository } from './oauth-state-repository.js';

/** 简化 mock:每次 delete().where().returning() 返回的数据由 deleteReturn 控制 */
function makeMockDb(deleteReturn: unknown[] = []) {
  const deleteChain = {
    where: vi.fn().mockReturnThis(),
    returning: vi.fn(async () => deleteReturn),
  };
  const insertChain = {
    values: vi.fn().mockReturnThis(),
  };
  const db = {
    delete: vi.fn(() => deleteChain),
    insert: vi.fn(() => insertChain),
  };
  return { db, deleteChain, insertChain };
}

describe('DbOAuthStateRepository', () => {
  it('save 写入完整字段(含 codeVerifier 与 expiresAt)', async () => {
    const { db, insertChain } = makeMockDb();
    const repo = new DbOAuthStateRepository(db as never);
    const expiresAt = new Date(Date.now() + 60_000);
    await repo.save({
      state: 'state-1',
      providerCode: 'oidc',
      redirectUri: 'https://app/cb',
      codeVerifier: 'verifier-1',
      expiresAt,
    });
    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'state-1',
        userId: 0,
        providerCode: 'oidc',
        redirectUri: 'https://app/cb',
        codeVerifier: 'verifier-1',
      })
    );
  });

  it('consume 命中时返回记录', async () => {
    const future = new Date(Date.now() + 60_000);
    const { db } = makeMockDb([
      {
        state: 'state-x',
        providerCode: 'oidc',
        redirectUri: 'https://app/cb',
        codeVerifier: 'verifier-x',
        expiresAt: future,
      },
    ]);
    const repo = new DbOAuthStateRepository(db as never);
    const record = await repo.consume('state-x');
    expect(record).toEqual({
      state: 'state-x',
      providerCode: 'oidc',
      redirectUri: 'https://app/cb',
      codeVerifier: 'verifier-x',
      expiresAt: future,
    });
  });

  it('consume 不存在时返回 null', async () => {
    const { db } = makeMockDb([]);
    const repo = new DbOAuthStateRepository(db as never);
    expect(await repo.consume('no-such')).toBeNull();
  });

  it('consume 已过期记录返回 null(基于 expiresAt 判定)', async () => {
    const past = new Date(Date.now() - 1000);
    const { db } = makeMockDb([
      {
        state: 'expired',
        providerCode: 'oidc',
        redirectUri: 'cb',
        expiresAt: past,
      },
    ]);
    const repo = new DbOAuthStateRepository(db as never);
    expect(await repo.consume('expired')).toBeNull();
  });

  it('consume 是一次性:DB 层 DELETE RETURNING 保证原子,第二次自动 null', async () => {
    // DB 层语义:第二次 DELETE 不命中行 → returning 空数组 → consume null
    const future = new Date(Date.now() + 60_000);
    const { db, deleteChain } = makeMockDb([
      { state: 's', providerCode: 'p', redirectUri: 'r', expiresAt: future },
    ]);
    const repo = new DbOAuthStateRepository(db as never);
    expect(await repo.consume('s')).not.toBeNull();
    // 模拟 DB 行已被删
    deleteChain.returning.mockResolvedValueOnce([]);
    expect(await repo.consume('s')).toBeNull();
  });

  it('deleteExpired 调用 DELETE WHERE expiresAt < now', async () => {
    const { db, deleteChain } = makeMockDb([{ id: 1 }, { id: 2 }]);
    const repo = new DbOAuthStateRepository(db as never);
    const deleted = await repo.deleteExpired();
    expect(deleted).toBe(2);
    expect(db.delete).toHaveBeenCalledTimes(1);
    expect(deleteChain.returning).toHaveBeenCalled();
  });
});
