import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', () => ({
  readdirSync: vi.fn().mockReturnValue([]),
  statSync: vi.fn().mockReturnValue({ size: 0, birthtime: new Date() }),
}));

vi.mock('../../config/index.js', () => ({
  config: { upload: { dir: '/tmp/test-uploads' } },
}));

import { createStorageRoutes } from './storage.js';
import { readdirSync, statSync } from 'fs';

const mockedReaddirSync = vi.mocked(readdirSync);
const mockedStatSync = vi.mocked(statSync);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('control storage routes', () => {
  it('GET /stats returns storage stats', async () => {
    mockedReaddirSync.mockReturnValue([
      { name: 'file1.pdf', isFile: () => true, isDirectory: () => false },
      { name: 'file2.pdf', isFile: () => true, isDirectory: () => false },
    ] as never);
    mockedStatSync.mockReturnValue({ size: 1024 } as never);

    const app = createStorageRoutes();
    const res = await app.request('/stats');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stats.totalFiles).toBe(2);
  });

  it('GET /departments returns directory list', async () => {
    mockedReaddirSync.mockImplementation(((path: string) => {
      if (path === '/tmp/test-uploads') {
        return [
          { name: 'finance', isFile: () => false, isDirectory: () => true },
        ];
      }
      return [];
    }) as typeof readdirSync);
    mockedStatSync.mockReturnValue({ size: 0 } as never);

    const app = createStorageRoutes();
    const res = await app.request('/departments');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.departments).toHaveLength(1);
    expect(body.departments[0].name).toBe('finance');
  });

  it('GET /large-files returns file list', async () => {
    mockedReaddirSync.mockReturnValue([
      { name: 'big.pdf', isFile: () => true, isDirectory: () => false },
    ] as never);
    mockedStatSync.mockReturnValue({ size: 5000000, birthtime: new Date() } as never);

    const app = createStorageRoutes();
    const res = await app.request('/large-files');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.files).toHaveLength(1);
  });
});
