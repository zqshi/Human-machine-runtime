import { describe, it, expect } from 'vitest';
import { createWorkspace, archiveWorkspace } from './workspace.js';

describe('createWorkspace', () => {
  it('creates an active workspace', () => {
    const ws = createWorkspace({
      name: 'Dev Space',
      type: 'APP',
      ownerId: 'user_1',
      tenantId: 'tn_1',
    });
    expect(ws.name).toBe('Dev Space');
    expect(ws.type).toBe('APP');
    expect(ws.status).toBe('active');
    expect(ws.id).toMatch(/^ws_/);
    expect(ws.metadata).toEqual({});
  });

  it('defaults description to empty string', () => {
    const ws = createWorkspace({
      name: 'Test',
      type: 'NORMAL',
      ownerId: 'u1',
      tenantId: 't1',
    });
    expect(ws.description).toBe('');
  });
});

describe('archiveWorkspace', () => {
  it('sets status to archived', () => {
    const ws = createWorkspace({
      name: 'Test',
      type: 'AGENT',
      ownerId: 'u1',
      tenantId: 't1',
    });
    const archived = archiveWorkspace(ws);
    expect(archived.status).toBe('archived');
    expect(archived.id).toBe(ws.id);
    expect(typeof archived.updatedAt).toBe('string');
  });
});
