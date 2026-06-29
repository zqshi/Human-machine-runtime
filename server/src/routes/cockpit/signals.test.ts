import { describe, it, expect, vi } from 'vitest';
import { createCockpitSignalRoutes } from './signals.js';
import type { SignalService } from '../../contexts/cockpit/application/signal-service.js';
import { EmergentSignal } from '../../contexts/cockpit/domain/sensing/emergent-signal.js';
import { Pattern } from '../../contexts/cockpit/domain/sensing/pattern.js';

function mockService(overrides: Partial<SignalService> = {}): SignalService {
  return {
    listSignals: vi.fn().mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 }),
    listEmergent: vi.fn().mockResolvedValue([]),
    listEmergentPaged: vi.fn().mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 }),
    getEmergent: vi.fn().mockResolvedValue(null),
    createEmergent: vi.fn(),
    updateEmergent: vi.fn().mockResolvedValue(null),
    listPatterns: vi.fn().mockResolvedValue([]),
    listPatternsPaged: vi.fn().mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 }),
    createPattern: vi.fn(),
    applyCorrections: vi.fn().mockResolvedValue({
      applied: 0,
      failed: 0,
      effective: false,
      note: 'correction 传播链路未接入执行引擎',
      affectedTasks: [],
    }),
    extractEmergentFromTrace: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as SignalService;
}

describe('cockpit signal routes', () => {
  it('GET /signals returns paged signals', async () => {
    const service = mockService({
      listSignals: vi.fn().mockResolvedValue({
        items: [{ id: 's-1', urgency: 'high' }],
        total: 1,
        limit: 50,
        offset: 0,
      }),
    });
    const app = createCockpitSignalRoutes(service);
    const res = await app.request('/signals');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it('GET /signals passes urgency filter to service', async () => {
    const service = mockService();
    const app = createCockpitSignalRoutes(service);
    await app.request('/signals?urgency=high');
    expect(service.listSignals).toHaveBeenCalledWith(expect.objectContaining({ urgency: 'high' }));
  });

  it('GET /signals/emergent returns paged emergent signals', async () => {
    const service = mockService();
    const app = createCockpitSignalRoutes(service);
    const res = await app.request('/signals/emergent');
    expect(res.status).toBe(200);
    expect(service.listEmergentPaged).toHaveBeenCalled();
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });

  it('POST /signals/emergent creates + serializes (createdAt epoch ms, 非 ISO)', async () => {
    const sig = EmergentSignal.create({
      pattern: 'spike',
      severity: 'high',
      detectedAt: 1_700_000_000_000,
    });
    const service = mockService({ createEmergent: vi.fn().mockResolvedValue(sig) });
    const app = createCockpitSignalRoutes(service);
    const res = await app.request('/signals/emergent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: 'spike', severity: 'high' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.pattern).toBe('spike');
    expect(body.severity).toBe('high');
    expect(body.status).toBe('detected');
    expect(body.detectedAt).toBe(1_700_000_000_000);
    expect(body.createdAt).toBeTypeOf('number');
  });

  it('PATCH /signals/emergent/:id returns 404 when not found', async () => {
    const service = mockService({ updateEmergent: vi.fn().mockResolvedValue(null) });
    const app = createCockpitSignalRoutes(service);
    const res = await app.request('/signals/emergent/sig-999', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resolve' }),
    });
    expect(res.status).toBe(404);
  });

  it('POST /corrections/apply honestly reports not effective', async () => {
    const service = mockService();
    const app = createCockpitSignalRoutes(service);
    const res = await app.request('/corrections/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId: 'p-1', actions: [{ type: 'scale' }] }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.applied).toBe(0);
    expect(body.effective).toBe(false);
  });

  it('GET /patterns returns paged patterns', async () => {
    const service = mockService();
    const app = createCockpitSignalRoutes(service);
    const res = await app.request('/patterns');
    expect(res.status).toBe(200);
    expect(service.listPatternsPaged).toHaveBeenCalled();
  });

  it('POST /patterns creates + serializes (createdAt epoch ms)', async () => {
    const p = Pattern.create({ pattern: 'repeat-fail', data: { count: 3 } });
    const service = mockService({ createPattern: vi.fn().mockResolvedValue(p) });
    const app = createCockpitSignalRoutes(service);
    const res = await app.request('/patterns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pattern: 'repeat-fail' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.pattern).toBe('repeat-fail');
    expect(body.patternType).toBe('pattern');
    expect(body.createdAt).toBeTypeOf('number');
  });
});
