import { describe, it, expect, vi } from 'vitest';
import { CredentialManagementService } from './credential-management-service.js';
import type { CredentialRepository } from '../../db/repositories/credential-repository.js';
import type { CredentialService } from './credential-service.js';
import type { LeaseService } from './lease-service.js';

function makeRepo() {
  return {
    createAuthorization: vi.fn(async () => ({
      id: 1,
      userId: 1,
      providerId: 1,
      externalAccountId: null,
      scope: null,
      status: 'active',
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    getAuthorization: vi.fn(async () => null),
    listAuthorizations: vi.fn(async () => []),
    deleteAuthorization: vi.fn(async () => {}),
    saveSecret: vi.fn(async () => 100),
    getSecretCiphertext: vi.fn(async () => null),
    listSecrets: vi.fn(async () => []),
    deleteSecrets: vi.fn(async () => {}),
    createLease: vi.fn(async () => ({
      id: 1,
      leaseId: 'uuid-1',
      userId: 1,
      providerId: 1,
      scope: null,
      status: 'active',
      expiresAt: new Date(),
      createdAt: new Date(),
      revokedAt: null,
    })),
    findValidLease: vi.fn(async () => null),
    revokeLease: vi.fn(async () => {}),
    listLeases: vi.fn(async () => []),
    revokeExpiredLeases: vi.fn(async () => 0),
  } as unknown as CredentialRepository;
}

function makeCredentialService() {
  return {
    encrypt: vi.fn((p: string) => `enc:${p}`),
    decrypt: vi.fn((c: string) => c.replace('enc:', '')),
  } as unknown as CredentialService;
}

function makeLeaseService() {
  return {
    computeExpiry: vi.fn((ttl?: number) => new Date(Date.now() + (ttl ?? 3600) * 1000)),
    isExpired: vi.fn(() => false),
    generateLeaseId: vi.fn(() => 'uuid'),
  } as unknown as LeaseService;
}

describe('CredentialManagementService', () => {
  it('createCredential: encrypt plaintext + 存 authorization + secret', async () => {
    const repo = makeRepo();
    const cs = makeCredentialService();
    const svc = new CredentialManagementService(repo, cs, makeLeaseService());
    const result = await svc.createCredential({
      userId: 1,
      providerId: 2,
      secretType: 'api_key',
      plaintext: 'secret123',
    });
    expect(result.id).toBe(1);
    expect(repo.createAuthorization).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 1, providerId: 2 })
    );
    expect(cs.encrypt).toHaveBeenCalledWith('secret123');
    expect(repo.saveSecret).toHaveBeenCalledWith(1, 'api_key', 'enc:secret123');
  });

  it('getCredential: 返回详情含 secret 元数据,不含 ciphertext(安全)', async () => {
    const repo = makeRepo();
    (repo.getAuthorization as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      userId: 1,
      providerId: 1,
      externalAccountId: null,
      scope: null,
      status: 'active',
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (repo.listSecrets as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 100,
        authorizationId: 1,
        secretType: 'api_key',
        keyVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const svc = new CredentialManagementService(repo, makeCredentialService(), makeLeaseService());
    const detail = await svc.getCredential(1);
    expect(detail).not.toBeNull();
    expect(detail!.secrets).toHaveLength(1);
    expect(JSON.stringify(detail!.secrets[0])).not.toContain('ciphertext');
  });

  it('getCredential: 不存在返回 null', async () => {
    const repo = makeRepo();
    const svc = new CredentialManagementService(repo, makeCredentialService(), makeLeaseService());
    const detail = await svc.getCredential(999);
    expect(detail).toBeNull();
  });

  it('getCredentialSecret: 解密返回明文', async () => {
    const repo = makeRepo();
    (repo.getSecretCiphertext as ReturnType<typeof vi.fn>).mockResolvedValue('enc:secret123');
    const cs = makeCredentialService();
    const svc = new CredentialManagementService(repo, cs, makeLeaseService());
    const secret = await svc.getCredentialSecret(1, 'api_key');
    expect(secret).toBe('secret123');
    expect(cs.decrypt).toHaveBeenCalledWith('enc:secret123');
  });

  it('getCredentialSecret: 密文不存在返回 null', async () => {
    const repo = makeRepo();
    const svc = new CredentialManagementService(repo, makeCredentialService(), makeLeaseService());
    const secret = await svc.getCredentialSecret(1, 'api_key');
    expect(secret).toBeNull();
  });

  it('issueLease: 用 leaseService.computeExpiry 计算过期 + createLease', async () => {
    const repo = makeRepo();
    const ls = makeLeaseService();
    const svc = new CredentialManagementService(repo, makeCredentialService(), ls);
    const lease = await svc.issueLease({ userId: 1, providerId: 2, ttlSec: 1800 });
    expect(ls.computeExpiry).toHaveBeenCalledWith(1800);
    expect(repo.createLease).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 1, providerId: 2 })
    );
    expect(lease.leaseId).toBe('uuid-1');
  });

  it('issueLease: ttlSec 缺省用 leaseService 默认 TTL', async () => {
    const repo = makeRepo();
    const ls = makeLeaseService();
    const svc = new CredentialManagementService(repo, makeCredentialService(), ls);
    await svc.issueLease({ userId: 1, providerId: 2 });
    expect(ls.computeExpiry).toHaveBeenCalledWith(undefined);
  });

  it('deleteCredential: 调 repo.deleteAuthorization', async () => {
    const repo = makeRepo();
    const svc = new CredentialManagementService(repo, makeCredentialService(), makeLeaseService());
    await svc.deleteCredential(1);
    expect(repo.deleteAuthorization).toHaveBeenCalledWith(1);
  });

  it('revokeLease: 调 repo.revokeLease', async () => {
    const repo = makeRepo();
    const svc = new CredentialManagementService(repo, makeCredentialService(), makeLeaseService());
    await svc.revokeLease('uuid-1');
    expect(repo.revokeLease).toHaveBeenCalledWith('uuid-1');
  });

  it('listLeases: 透传 filter/分页给 repo', async () => {
    const repo = makeRepo();
    const svc = new CredentialManagementService(repo, makeCredentialService(), makeLeaseService());
    await svc.listLeases({ status: 'active' }, 10, 20);
    expect(repo.listLeases).toHaveBeenCalledWith({ status: 'active' }, 10, 20);
  });
});
