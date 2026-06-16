import { describe, it, expect, vi } from 'vitest';

vi.mock('node:fs', () => ({
  mkdirSync: vi.fn(),
  readdirSync: vi.fn().mockReturnValue([]),
  createWriteStream: vi.fn().mockReturnValue({ write: vi.fn(), end: vi.fn(), on: vi.fn() }),
  createReadStream: vi.fn(),
  statSync: vi.fn().mockReturnValue({ size: 100 }),
}));

vi.mock('../../config/index.js', () => ({
  config: { upload: { dir: '/tmp/test-uploads', maxSizeMb: 10 } },
}));

vi.mock('node:stream/promises', () => ({
  pipeline: vi.fn().mockResolvedValue(undefined),
}));

import { createUploadRoutes } from './uploads.js';
import { readdirSync } from 'node:fs';

describe('control upload routes', () => {
  it('POST / returns 400 without file field', async () => {
    const app = createUploadRoutes();
    const formData = new FormData();
    formData.append('other', 'value');
    const res = await app.request('/', { method: 'POST', body: formData });
    expect(res.status).toBe(400);
  });

  it('POST / uploads file successfully', async () => {
    const app = createUploadRoutes();
    const formData = new FormData();
    formData.append('file', new File(['test content'], 'test.txt', { type: 'text/plain' }));
    const res = await app.request('/', { method: 'POST', body: formData });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.file.originalName).toBe('test.txt');
    expect(body.file.id).toBeDefined();
  });

  it('GET /:id returns 404 when file not found', async () => {
    vi.mocked(readdirSync).mockReturnValue([]);
    const app = createUploadRoutes();
    const res = await app.request('/nonexistent');
    expect(res.status).toBe(404);
  });
});
