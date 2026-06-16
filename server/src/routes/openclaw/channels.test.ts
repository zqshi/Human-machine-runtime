import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { createOpenclawChannelRoutes } from './channels.js';

function mockUser() {
  return { username: 'testuser', tenantId: 'tn_test', roles: ['user'] };
}

function withAuth(app: Hono) {
  const wrapper = new Hono();
  wrapper.use('*', async (c, next) => {
    c.set('user', mockUser());
    await next();
  });
  wrapper.route('/', app);
  return wrapper;
}

function mockDecisionConsole() {
  return {
    getChannelHealth: vi.fn().mockResolvedValue([{ channel: 'matrix', status: 'healthy' }]),
    getAggregatedView: vi.fn().mockResolvedValue({ channels: [], total: 0 }),
    getUnifiedTimeline: vi.fn().mockResolvedValue({ items: [], hasMore: false }),
    dispatch: vi.fn().mockResolvedValue({ dispatched: 1 }),
    switchChannel: vi.fn().mockResolvedValue({ success: true }),
  };
}

function mockChannelService() {
  return {
    listChannelTypes: vi.fn().mockReturnValue(['matrix', 'email', 'webhook']),
  };
}

describe('openclaw channel routes', () => {
  it('GET /channels returns health and available types', async () => {
    const dc = mockDecisionConsole();
    const cs = mockChannelService();
    const app = withAuth(createOpenclawChannelRoutes(dc as never, cs as never));
    const res = await app.request('/channels');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.channels).toHaveLength(1);
    expect(body.available).toEqual(['matrix', 'email', 'webhook']);
  });

  it('GET /channels/view returns aggregated view', async () => {
    const dc = mockDecisionConsole();
    const cs = mockChannelService();
    const app = withAuth(createOpenclawChannelRoutes(dc as never, cs as never));
    const res = await app.request('/channels/view');
    expect(res.status).toBe(200);
    expect(dc.getAggregatedView).toHaveBeenCalledWith('testuser');
  });

  it('GET /channels/timeline passes query params', async () => {
    const dc = mockDecisionConsole();
    const cs = mockChannelService();
    const app = withAuth(createOpenclawChannelRoutes(dc as never, cs as never));
    const res = await app.request('/channels/timeline?limit=10&channels=matrix,email');
    expect(res.status).toBe(200);
    expect(dc.getUnifiedTimeline).toHaveBeenCalledWith('testuser', {
      limit: 10,
      before: undefined,
      channelTypes: ['matrix', 'email'],
    });
  });

  it('POST /channels/dispatch returns 400 on missing fields', async () => {
    const dc = mockDecisionConsole();
    const cs = mockChannelService();
    const app = withAuth(createOpenclawChannelRoutes(dc as never, cs as never));
    const res = await app.request('/channels/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetChannels: [], roomId: '', message: {} }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /channels/dispatch dispatches on valid input', async () => {
    const dc = mockDecisionConsole();
    const cs = mockChannelService();
    const app = withAuth(createOpenclawChannelRoutes(dc as never, cs as never));
    const res = await app.request('/channels/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetChannels: ['matrix'],
        roomId: 'room-1',
        message: { type: 'text', content: 'Hello' },
      }),
    });
    expect(res.status).toBe(200);
    expect(dc.dispatch).toHaveBeenCalled();
  });

  it('POST /channels/switch returns 400 on missing fields', async () => {
    const dc = mockDecisionConsole();
    const cs = mockChannelService();
    const app = withAuth(createOpenclawChannelRoutes(dc as never, cs as never));
    const res = await app.request('/channels/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: '', fromChannel: '', toChannel: '' }),
    });
    expect(res.status).toBe(400);
  });
});
