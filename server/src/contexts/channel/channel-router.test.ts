import { describe, it, expect, vi } from 'vitest';
import { ChannelRouter } from './channel-router.js';
import type { ChannelService } from './channel-service.js';
import type { IChannelRoutingRepository } from './channel-routing-repository.js';
import type { InboundMessage, ChannelType } from './channel-adapter.js';

function makeMsg(overrides: Partial<InboundMessage> = {}): InboundMessage {
  return {
    id: 'msg-1',
    channelType: 'websocket',
    sender: { id: 'u1', channel: 'websocket' },
    roomId: 'room-1',
    content: 'hello',
    contentType: 'text',
    receivedAt: new Date(),
    ...overrides,
  };
}

function makeMockRepo(
  overrides: Partial<IChannelRoutingRepository> = {}
): IChannelRoutingRepository {
  return {
    listRules: vi.fn().mockResolvedValue([]),
    upsertRule: vi.fn().mockResolvedValue(undefined),
    removeRule: vi.fn().mockResolvedValue(undefined),
    getUserPreference: vi.fn().mockResolvedValue([]),
    setUserPreference: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeMockChannelService(connected: ChannelType[] = ['websocket']): ChannelService {
  return {
    getAdapter: vi.fn().mockImplementation((ch: ChannelType) => {
      if (connected.includes(ch)) {
        return { getStatus: () => Promise.resolve({ channelType: ch, connected: true }) };
      }
      return undefined;
    }),
    listChannelTypes: vi.fn().mockReturnValue(connected),
  } as unknown as ChannelService;
}

describe('ChannelRouter', () => {
  describe('resolveTargetChannels', () => {
    it('falls back to websocket when no rules or prefs', async () => {
      const repo = makeMockRepo();
      const cs = makeMockChannelService();
      const router = new ChannelRouter(cs, repo);

      const result = await router.resolveTargetChannels(makeMsg());
      expect(result).toEqual(['websocket']);
    });

    it('matches rule by channelType condition', async () => {
      const repo = makeMockRepo({
        listRules: vi.fn().mockResolvedValue([
          {
            id: 'r1',
            condition: { channelType: 'wps' },
            targetChannels: ['matrix', 'lark'],
            priority: 10,
          },
        ]),
      });
      const cs = makeMockChannelService();
      const router = new ChannelRouter(cs, repo);

      const result = await router.resolveTargetChannels(makeMsg({ channelType: 'wps' }));
      expect(result).toEqual(['matrix', 'lark']);
    });

    it('matches rule by messageType condition', async () => {
      const repo = makeMockRepo({
        listRules: vi
          .fn()
          .mockResolvedValue([
            { id: 'r1', condition: { messageType: 'card' }, targetChannels: ['lark'], priority: 5 },
          ]),
      });
      const cs = makeMockChannelService();
      const router = new ChannelRouter(cs, repo);

      const result = await router.resolveTargetChannels(makeMsg({ contentType: 'card' }));
      expect(result).toEqual(['lark']);
    });

    it('matches rule by userId condition', async () => {
      const repo = makeMockRepo({
        listRules: vi
          .fn()
          .mockResolvedValue([
            { id: 'r1', condition: { userId: 'u1' }, targetChannels: ['dingtalk'], priority: 1 },
          ]),
      });
      const cs = makeMockChannelService();
      const router = new ChannelRouter(cs, repo);

      const result = await router.resolveTargetChannels(makeMsg());
      expect(result).toEqual(['dingtalk']);
    });

    it('picks highest priority rule when multiple match', async () => {
      const repo = makeMockRepo({
        listRules: vi.fn().mockResolvedValue([
          {
            id: 'low',
            condition: { channelType: 'websocket' },
            targetChannels: ['email'],
            priority: 1,
          },
          {
            id: 'high',
            condition: { channelType: 'websocket' },
            targetChannels: ['lark'],
            priority: 100,
          },
        ]),
      });
      const cs = makeMockChannelService();
      const router = new ChannelRouter(cs, repo);

      const result = await router.resolveTargetChannels(makeMsg());
      expect(result).toEqual(['lark']);
    });

    it('falls through to user preference when no rule matches', async () => {
      const repo = makeMockRepo({
        listRules: vi.fn().mockResolvedValue([
          {
            id: 'r1',
            condition: { channelType: 'wps' },
            targetChannels: ['email'],
            priority: 10,
          },
        ]),
        getUserPreference: vi.fn().mockResolvedValue(['dingtalk']),
      });
      const cs = makeMockChannelService();
      const router = new ChannelRouter(cs, repo);

      const result = await router.resolveTargetChannels(makeMsg({ channelType: 'websocket' }));
      expect(result).toEqual(['dingtalk']);
    });

    it('does not match when condition partially fails', async () => {
      const repo = makeMockRepo({
        listRules: vi.fn().mockResolvedValue([
          {
            id: 'r1',
            condition: { channelType: 'wps', userId: 'u2' },
            targetChannels: ['lark'],
            priority: 10,
          },
        ]),
      });
      const cs = makeMockChannelService();
      const router = new ChannelRouter(cs, repo);

      const result = await router.resolveTargetChannels(
        makeMsg({ channelType: 'wps', sender: { id: 'u1', channel: 'wps' } })
      );
      expect(result).toEqual(['websocket']);
    });
  });

  describe('routeOutbound', () => {
    it('uses user preference when reachable', async () => {
      const repo = makeMockRepo({
        getUserPreference: vi.fn().mockResolvedValue(['lark', 'matrix']),
      });
      const cs = makeMockChannelService(['lark', 'matrix', 'websocket']);
      const router = new ChannelRouter(cs, repo);

      const result = await router.routeOutbound('u1', { type: 'text', content: 'hi' });
      expect(result).toEqual(['lark', 'matrix']);
    });

    it('falls back to websocket when prefs unreachable', async () => {
      const repo = makeMockRepo({
        getUserPreference: vi.fn().mockResolvedValue(['lark']),
      });
      const cs = makeMockChannelService(['websocket']);
      const router = new ChannelRouter(cs, repo);

      const result = await router.routeOutbound('u1', { type: 'text', content: 'hi' });
      expect(result).toEqual(['websocket']);
    });

    it('falls back to websocket when no preference set', async () => {
      const repo = makeMockRepo();
      const cs = makeMockChannelService(['websocket', 'matrix']);
      const router = new ChannelRouter(cs, repo);

      const result = await router.routeOutbound('u1', { type: 'text', content: 'hi' });
      expect(result).toEqual(['websocket']);
    });
  });

  describe('CRUD delegation', () => {
    it('upsertRule delegates to repo', async () => {
      const repo = makeMockRepo();
      const cs = makeMockChannelService();
      const router = new ChannelRouter(cs, repo);
      const rule = {
        id: 'r1',
        condition: {},
        targetChannels: ['lark' as ChannelType],
        priority: 1,
      };

      await router.upsertRule(rule);
      expect(repo.upsertRule).toHaveBeenCalledWith(rule);
    });

    it('removeRule delegates to repo', async () => {
      const repo = makeMockRepo();
      const cs = makeMockChannelService();
      const router = new ChannelRouter(cs, repo);

      await router.removeRule('r1');
      expect(repo.removeRule).toHaveBeenCalledWith('r1');
    });

    it('setUserPreference delegates to repo', async () => {
      const repo = makeMockRepo();
      const cs = makeMockChannelService();
      const router = new ChannelRouter(cs, repo);

      await router.setUserPreference('u1', ['matrix', 'lark']);
      expect(repo.setUserPreference).toHaveBeenCalledWith('u1', ['matrix', 'lark']);
    });

    it('getUserPreference delegates to repo', async () => {
      const repo = makeMockRepo({
        getUserPreference: vi.fn().mockResolvedValue(['wecom']),
      });
      const cs = makeMockChannelService();
      const router = new ChannelRouter(cs, repo);

      const result = await router.getUserPreference('u1');
      expect(result).toEqual(['wecom']);
    });
  });
});
