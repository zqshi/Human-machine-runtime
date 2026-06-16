import { describe, it, expect, vi } from 'vitest';
import { DecisionConsole } from './decision-console.js';
import { ChannelService } from './channel-service.js';
import { ChannelRouter } from './channel-router.js';
import type { IChannelAdapter, ChannelType } from './channel-adapter.js';
import type { IChannelRoutingRepository } from './channel-routing-repository.js';

function mockAdapter(type: string, connected = true): IChannelAdapter {
  return {
    channelType: type,
    supportsInbound: false,
    sendMessage: vi.fn().mockResolvedValue(undefined),
    getStatus: vi.fn().mockResolvedValue({ channelType: type, connected }),
    listConversations: vi.fn().mockResolvedValue([
      {
        id: `room_${type}_1`,
        channelType: type,
        name: `Room ${type}`,
        lastMessage: 'hello',
        lastMessageAt: new Date('2026-01-01T12:00:00Z'),
        unreadCount: 2,
      },
    ]),
  };
}

function buildConsole(...adapters: IChannelAdapter[]) {
  const svc = new ChannelService();
  for (const a of adapters) svc.registerAdapter(a);
  return { console: new DecisionConsole(svc), channelService: svc };
}

function mockRepo(overrides: Partial<IChannelRoutingRepository> = {}): IChannelRoutingRepository {
  return {
    listRules: vi.fn().mockResolvedValue([]),
    upsertRule: vi.fn().mockResolvedValue(undefined),
    removeRule: vi.fn().mockResolvedValue(undefined),
    getUserPreference: vi.fn().mockResolvedValue([]),
    setUserPreference: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('DecisionConsole', () => {
  describe('getAggregatedView', () => {
    it('returns conversations and channel statuses', async () => {
      const { console: dc } = buildConsole(mockAdapter('matrix'), mockAdapter('wps'));
      const view = await dc.getAggregatedView('user1');
      expect(view.conversations).toHaveLength(2);
      expect(view.channels).toHaveLength(2);
    });
  });

  describe('getUnifiedTimeline', () => {
    it('returns timeline entries from all channels', async () => {
      const { console: dc } = buildConsole(mockAdapter('matrix'), mockAdapter('wps'));
      const timeline = await dc.getUnifiedTimeline('user1');
      expect(timeline.entries).toHaveLength(2);
      expect(timeline.hasMore).toBe(false);
      expect(timeline.channels).toEqual(['matrix', 'wps']);
    });

    it('filters by channel type', async () => {
      const { console: dc } = buildConsole(mockAdapter('matrix'), mockAdapter('wps'));
      const timeline = await dc.getUnifiedTimeline('user1', { channelTypes: ['matrix'] });
      expect(timeline.entries).toHaveLength(1);
      expect(timeline.entries[0].channelType).toBe('matrix');
    });

    it('respects limit', async () => {
      const { console: dc } = buildConsole(mockAdapter('matrix'), mockAdapter('wps'));
      const timeline = await dc.getUnifiedTimeline('user1', { limit: 1 });
      expect(timeline.entries).toHaveLength(1);
      expect(timeline.hasMore).toBe(true);
    });
  });

  describe('getChannelHealth', () => {
    it('returns health info for all channels', async () => {
      const { console: dc } = buildConsole(mockAdapter('matrix', true), mockAdapter('wps', false));
      const health = await dc.getChannelHealth();
      expect(health).toHaveLength(2);
      expect(health.find((h) => h.channelType === 'matrix')?.connected).toBe(true);
      expect(health.find((h) => h.channelType === 'wps')?.connected).toBe(false);
      expect(health[0].checkedAt).toBeTruthy();
    });
  });

  describe('switchChannel', () => {
    it('succeeds when target channel is connected', async () => {
      const { console: dc } = buildConsole(mockAdapter('matrix'), mockAdapter('wps'));
      const result = await dc.switchChannel('user1', 'conv1', 'matrix', 'wps');
      expect(result.success).toBe(true);
      expect(result.fromChannel).toBe('matrix');
      expect(result.toChannel).toBe('wps');
    });

    it('fails when target channel is not registered', async () => {
      const { console: dc } = buildConsole(mockAdapter('matrix'));
      const result = await dc.switchChannel('user1', 'conv1', 'matrix', 'lark');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not registered');
    });

    it('fails when target channel is disconnected', async () => {
      const { console: dc } = buildConsole(mockAdapter('matrix'), mockAdapter('wps', false));
      const result = await dc.switchChannel('user1', 'conv1', 'matrix', 'wps');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not connected');
    });

    it('sends notification message when provided', async () => {
      const wps = mockAdapter('wps');
      const { console: dc } = buildConsole(mockAdapter('matrix'), wps);
      await dc.switchChannel('user1', 'conv1', 'matrix', 'wps', {
        type: 'text',
        content: '会话已迁移',
      });
      expect(wps.sendMessage).toHaveBeenCalled();
    });
  });

  describe('dispatch', () => {
    it('sends to multiple channels', async () => {
      const matrix = mockAdapter('matrix');
      const wps = mockAdapter('wps');
      const { console: dc } = buildConsole(matrix, wps);

      const result = await dc.dispatch({
        targetChannels: ['matrix', 'wps'],
        roomId: 'room1',
        message: { type: 'text', content: 'broadcast' },
      });
      expect(result.successes).toEqual(['matrix', 'wps']);
      expect(result.failures).toHaveLength(0);
    });

    it('reports failures per channel', async () => {
      const matrix = mockAdapter('matrix');
      (matrix.sendMessage as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('timeout'));
      const { console: dc } = buildConsole(matrix);

      const result = await dc.dispatch({
        targetChannels: ['matrix'],
        roomId: 'room1',
        message: { type: 'text', content: 'test' },
      });
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].error).toBe('timeout');
    });
  });

  describe('routeMessage', () => {
    it('dispatches to websocket fallback when no router', async () => {
      const ws = mockAdapter('websocket');
      const svc = new ChannelService();
      svc.registerAdapter(ws);
      const dc = new DecisionConsole(svc);

      const result = await dc.routeMessage('u1', { type: 'text', content: 'hi' });
      expect(result.successes).toEqual(['websocket']);
      expect(ws.sendMessage).toHaveBeenCalled();
    });

    it('uses router to resolve targets', async () => {
      const lark = mockAdapter('lark');
      const ws = mockAdapter('websocket');
      const svc = new ChannelService();
      svc.registerAdapter(lark);
      svc.registerAdapter(ws);

      const repo = mockRepo({ getUserPreference: vi.fn().mockResolvedValue(['lark']) });
      const router = new ChannelRouter(svc, repo);
      const dc = new DecisionConsole(svc, router);

      const result = await dc.routeMessage('u1', { type: 'text', content: 'hi' });
      expect(result.successes).toEqual(['lark']);
    });
  });

  describe('routing rule management', () => {
    it('getRoutingRules returns empty without router', async () => {
      const { console: dc } = buildConsole(mockAdapter('matrix'));
      expect(await dc.getRoutingRules()).toEqual([]);
    });

    it('setRoutingRule delegates to router', async () => {
      const svc = new ChannelService();
      svc.registerAdapter(mockAdapter('websocket'));
      const repo = mockRepo();
      const router = new ChannelRouter(svc, repo);
      const dc = new DecisionConsole(svc, router);

      const rule = {
        id: 'r1',
        condition: {},
        targetChannels: ['lark' as ChannelType],
        priority: 5,
      };
      await dc.setRoutingRule(rule);
      expect(repo.upsertRule).toHaveBeenCalledWith(rule);
    });

    it('removeRoutingRule delegates to router', async () => {
      const svc = new ChannelService();
      svc.registerAdapter(mockAdapter('websocket'));
      const repo = mockRepo();
      const router = new ChannelRouter(svc, repo);
      const dc = new DecisionConsole(svc, router);

      await dc.removeRoutingRule('r1');
      expect(repo.removeRule).toHaveBeenCalledWith('r1');
    });
  });

  describe('user preference', () => {
    it('getUserPreference returns empty without router', async () => {
      const { console: dc } = buildConsole(mockAdapter('matrix'));
      expect(await dc.getUserPreference('u1')).toEqual([]);
    });

    it('setUserPreference delegates to router', async () => {
      const svc = new ChannelService();
      svc.registerAdapter(mockAdapter('websocket'));
      const repo = mockRepo();
      const router = new ChannelRouter(svc, repo);
      const dc = new DecisionConsole(svc, router);

      await dc.setUserPreference('u1', ['matrix', 'lark']);
      expect(repo.setUserPreference).toHaveBeenCalledWith('u1', ['matrix', 'lark']);
    });

    it('getUserPreference returns value from router', async () => {
      const svc = new ChannelService();
      svc.registerAdapter(mockAdapter('websocket'));
      const repo = mockRepo({ getUserPreference: vi.fn().mockResolvedValue(['wecom']) });
      const router = new ChannelRouter(svc, repo);
      const dc = new DecisionConsole(svc, router);

      expect(await dc.getUserPreference('u1')).toEqual(['wecom']);
    });
  });
});
