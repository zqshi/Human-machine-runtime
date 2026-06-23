import { describe, it, expect, vi } from 'vitest';
import { createAdminCredentialRoutes } from './credentials.js';
import type { CredentialManagementService } from '../../contexts/credential-vault/credential-management-service.js';

function mockSvc() {
  return {
    listCredentials: vi.fn().mockResolvedValue([{ id: 1, userId: 1, providerId: 1 }]),
    getCredential: vi
      .fn()
      .mockResolvedValue({ id: 1, userId: 1, providerId: 1, externalAccountId: null, secrets: [] }),
    createCredential: vi.fn().mockResolvedValue({ id: 5 }),
    deleteCredential: vi.fn().mockResolvedValue(undefined),
    getCredentialSecret: vi.fn().mockResolvedValue('plaintext'),
    issueLease: vi.fn().mockResolvedValue({ leaseId: 'uuid-1', status: 'active' }),
    revokeLease: vi.fn().mockResolvedValue(undefined),
    listLeases: vi.fn().mockResolvedValue([{ leaseId: 'uuid-1' }]),
  } as unknown as CredentialManagementService;
}

describe('createAdminCredentialRoutes', () => {
  it('GET / 列表(分页 limit/offset 透传)', async () => {
    const svc = mockSvc();
    const app = createAdminCredentialRoutes(svc);
    const res = await app.request('/?limit=10&offset=20');
    expect(res.status).toBe(200);
    expect(svc.listCredentials).toHaveBeenCalledWith(10, 20);
    const body = await res.json();
    expect(body.credentials).toHaveLength(1);
  });

  it('GET / limit 上限 200(防无限制全量返回,§7.2.1 规则2)', async () => {
    const svc = mockSvc();
    const app = createAdminCredentialRoutes(svc);
    await app.request('/?limit=99999');
    expect(svc.listCredentials).toHaveBeenCalledWith(200, 0);
  });

  it('POST / 创建凭证', async () => {
    const svc = mockSvc();
    const app = createAdminCredentialRoutes(svc);
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 1,
        providerId: 2,
        secretType: 'api_key',
        plaintext: 'secret',
      }),
    });
    expect(res.status).toBe(201);
    expect(svc.createCredential).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 1, providerId: 2, secretType: 'api_key' })
    );
  });

  it('POST / 校验失败(缺必填)返回 400', async () => {
    const svc = mockSvc();
    const app = createAdminCredentialRoutes(svc);
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 1 }),
    });
    expect(res.status).toBe(400);
    expect(svc.createCredential).not.toHaveBeenCalled();
  });

  it('GET /:id 详情', async () => {
    const svc = mockSvc();
    const app = createAdminCredentialRoutes(svc);
    const res = await app.request('/1');
    expect(res.status).toBe(200);
    expect(svc.getCredential).toHaveBeenCalledWith(1);
  });

  it('GET /:id 不存在返回 404', async () => {
    const svc = mockSvc();
    (svc.getCredential as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const app = createAdminCredentialRoutes(svc);
    const res = await app.request('/1');
    expect(res.status).toBe(404);
  });

  it('GET /:id 非数字返回 400', async () => {
    const svc = mockSvc();
    const app = createAdminCredentialRoutes(svc);
    const res = await app.request('/abc');
    expect(res.status).toBe(400);
  });

  it('DELETE /:id', async () => {
    const svc = mockSvc();
    const app = createAdminCredentialRoutes(svc);
    const res = await app.request('/1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(svc.deleteCredential).toHaveBeenCalledWith(1);
  });

  it('POST /:id/leases 签发(从 credential 取 userId/providerId)', async () => {
    const svc = mockSvc();
    const app = createAdminCredentialRoutes(svc);
    const res = await app.request('/1/leases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttlSec: 1800 }),
    });
    expect(res.status).toBe(201);
    expect(svc.issueLease).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 1, providerId: 1, ttlSec: 1800 })
    );
  });

  it('GET /leases 列表(静态路径不被 /:id 捕获)', async () => {
    const svc = mockSvc();
    const app = createAdminCredentialRoutes(svc);
    const res = await app.request('/leases?status=active');
    expect(res.status).toBe(200);
    expect(svc.listLeases).toHaveBeenCalledWith({ status: 'active' }, 50, 0);
  });

  it('DELETE /leases/:leaseId 吊销', async () => {
    const svc = mockSvc();
    const app = createAdminCredentialRoutes(svc);
    const res = await app.request('/leases/uuid-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(svc.revokeLease).toHaveBeenCalledWith('uuid-1');
  });
});
