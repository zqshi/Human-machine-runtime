import { describe, it, expect, vi, beforeEach } from 'vitest';
import { credentialManagementApi } from '../credentialManagementApi';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    text: () => Promise.resolve(JSON.stringify(data)),
    json: () => Promise.resolve(data),
  };
}

describe('credentialManagementApi', () => {
  beforeEach(() => mockFetch.mockReset());

  it('listCredentials: GET /api/admin/credentials with limit/offset query', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ credentials: [] }));
    await credentialManagementApi.listCredentials({ limit: 20, offset: 0 });
    const [path] = mockFetch.mock.calls[0];
    expect(path).toBe('/api/admin/credentials?limit=20&offset=0');
    // GET 请求 httpClient 不显式传 method（默认 GET），fetch 调用无 method 字段，参照 v19AdminApi.listPending
  });

  it('listCredentials: 默认 limit/offset', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ credentials: [] }));
    await credentialManagementApi.listCredentials();
    expect(mockFetch.mock.calls[0][0]).toBe('/api/admin/credentials?limit=50&offset=0');
  });

  it('createCredential: POST /api/admin/credentials with body（含明文）', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ id: 1 }, 201));
    await credentialManagementApi.createCredential({
      userId: 1,
      providerId: 2,
      secretType: 'password',
      plaintext: 's3cret',
      externalAccountId: 'acct-x',
      scope: 'read',
    });
    const [path, init] = mockFetch.mock.calls[0];
    expect(path).toBe('/api/admin/credentials');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      userId: 1,
      providerId: 2,
      secretType: 'password',
      plaintext: 's3cret',
      externalAccountId: 'acct-x',
      scope: 'read',
    });
  });

  it('getCredential: GET /api/admin/credentials/:id', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ id: 42, secrets: [] }));
    await credentialManagementApi.getCredential(42);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/admin/credentials/42');
  });

  it('deleteCredential: DELETE /api/admin/credentials/:id', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ success: true }));
    await credentialManagementApi.deleteCredential(42);
    const [path, init] = mockFetch.mock.calls[0];
    expect(path).toBe('/api/admin/credentials/42');
    expect(init.method).toBe('DELETE');
  });

  it('listLeases: GET /api/admin/credentials/leases with status filter', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ leases: [] }));
    await credentialManagementApi.listLeases({ status: 'active', limit: 20, offset: 0 });
    expect(mockFetch.mock.calls[0][0]).toBe(
      '/api/admin/credentials/leases?limit=20&offset=0&status=active'
    );
  });

  it('listLeases: status 缺省时不带 status query', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ leases: [] }));
    await credentialManagementApi.listLeases({ limit: 20, offset: 0 });
    expect(mockFetch.mock.calls[0][0]).toBe('/api/admin/credentials/leases?limit=20&offset=0');
  });

  it('issueLease: POST /api/admin/credentials/:id/leases with ttlSec', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ id: 1, leaseId: 'uuid-1' }, 201));
    await credentialManagementApi.issueLease(42, { ttlSec: 3600 });
    const [path, init] = mockFetch.mock.calls[0];
    expect(path).toBe('/api/admin/credentials/42/leases');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ ttlSec: 3600 });
  });

  it('issueLease: ttlSec 缺省时 body 为空对象（后端用默认 TTL）', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ id: 1, leaseId: 'uuid-2' }, 201));
    await credentialManagementApi.issueLease(42);
    const [, init] = mockFetch.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({});
  });

  it('revokeLease: DELETE /api/admin/credentials/leases/:leaseId（UUID 编码）', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ success: true }));
    await credentialManagementApi.revokeLease('550e8400-e29b-41d4-a716-446655440000');
    const [path, init] = mockFetch.mock.calls[0];
    expect(path).toBe('/api/admin/credentials/leases/550e8400-e29b-41d4-a716-446655440000');
    expect(init.method).toBe('DELETE');
  });
});
