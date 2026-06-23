import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircuitBreaker, type CircuitBreakerOptions } from '../../../shared/resilience.js';
import { MatrixChannelAdapter } from './matrix-adapter.js';

/**
 * 测试需要把 config.matrix.* 注入。用 vi.mock 替换 config 模块。
 * 不直接 import config(它是单例),而是 mock 整个模块。
 */
vi.mock('../../../config/index.js', () => ({
  config: {
    matrix: {
      homeserverUrl: 'https://matrix.example.org',
      botAccessToken: 'syt_test_token',
      botUserId: '@bot:example.org',
    },
    env: 'test',
    cors: { origins: [] },
    auth: {
      defaultProvider: 'local',
      allowLocalFallback: true,
      session: { cookieName: 'hmr_session', maxAgeSec: 86400 },
      oidc: { redirectUri: '', issuer: '', clientId: '', clientSecret: '', scopes: [] },
      platformBe: { baseUrl: '', clientId: '', clientSecret: '', callbackUrl: '' },
      wpsOAuth: { clientId: '', clientSecret: '' },
      autoRegister: false,
    },
    jwt: { secret: 'test', expiresIn: '1h' },
    agent: { llmModel: '' },
    litellm: { baseUrl: '' },
    gateway: { timeoutMs: 5000 },
  },
}));

function okResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('MatrixChannelAdapter', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function makeAdapter(breaker?: CircuitBreaker): MatrixChannelAdapter {
    const breakerOptions: CircuitBreakerOptions = breaker?.['opts'] ?? {
      failureThreshold: 2,
      resetTimeoutMs: 50,
      halfOpenSuccessThreshold: 1,
    };
    return new MatrixChannelAdapter({ breaker, breakerOptions });
  }

  describe('sendMessage 韧性', () => {
    it('成功:1 次 fetch 即完成', async () => {
      fetchSpy.mockResolvedValueOnce(okResponse({ event_id: '$x' }));
      const adapter = makeAdapter();
      await adapter.sendMessage(
        { roomId: '!room:home' } as never,
        {
          type: 'text',
          content: 'hi',
        } as never
      );
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('前 2 次网络错误,第 3 次成功 → 总调用 3 次,最终成功', async () => {
      fetchSpy
        .mockRejectedValueOnce(new Error('network error 1'))
        .mockRejectedValueOnce(new Error('network error 2'))
        .mockResolvedValueOnce(okResponse({ event_id: '$x' }));

      const adapter = makeAdapter();
      await adapter.sendMessage(
        { roomId: '!room:home' } as never,
        {
          type: 'text',
          content: 'hi',
        } as never
      );

      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it('4xx 失败不重试,立即抛错', async () => {
      fetchSpy.mockResolvedValueOnce(okResponse({ error: 'forbidden' }, 403));
      const adapter = makeAdapter();
      await expect(
        adapter.sendMessage(
          { roomId: '!room:home' } as never,
          {
            type: 'text',
            content: 'hi',
          } as never
        )
      ).rejects.toThrow(/Matrix send failed: 403/);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('熔断打开时抛"circuit breaker open"', async () => {
      // 让 breaker 直接 open
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 60_000, // 永不 half-open
        halfOpenSuccessThreshold: 1,
      });
      // 触发一次失败让 breaker trip
      await breaker.execute(() => Promise.reject(new Error('trigger open'))).catch(() => {});

      const adapter = makeAdapter(breaker);
      await expect(
        adapter.sendMessage(
          { roomId: '!room:home' } as never,
          {
            type: 'text',
            content: 'hi',
          } as never
        )
      ).rejects.toThrow(/circuit breaker open/);

      // fetch 不应被调用
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('200 → connected:true', async () => {
      fetchSpy.mockResolvedValueOnce(okResponse({ user_id: '@bot:home' }));
      const adapter = makeAdapter();
      const status = await adapter.getStatus();
      expect(status.connected).toBe(true);
    });

    it('401 → connected:false', async () => {
      fetchSpy.mockResolvedValueOnce(okResponse({}, 401));
      const adapter = makeAdapter();
      const status = await adapter.getStatus();
      expect(status.connected).toBe(false);
    });

    it('未配置 token → connected:false + Not configured', async () => {
      const adapter = new MatrixChannelAdapter();
      // monkey-patch:清空 token
      (adapter as unknown as { botAccessToken: string }).botAccessToken = '';
      const status = await adapter.getStatus();
      expect(status.connected).toBe(false);
      expect(status.error).toContain('Not configured');
    });
  });

  describe('listConversations', () => {
    it('成功返回 joined_rooms', async () => {
      fetchSpy.mockResolvedValueOnce(okResponse({ joined_rooms: ['!a:home', '!b:home'] }));
      const adapter = makeAdapter();
      const result = await adapter.listConversations('user-1');
      expect(result).toHaveLength(2);
      expect(result[0]!.id).toBe('!a:home');
      expect(result[0]!.channelType).toBe('matrix');
    });

    it('fetch 抛错时返回空数组(不向上抛)', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('connection refused'));
      const adapter = makeAdapter();
      const result = await adapter.listConversations('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('入站 onInboundMessage + stop', () => {
    it('未配置 token 时不启动 sync loop', () => {
      const adapter = new MatrixChannelAdapter();
      (adapter as unknown as { botAccessToken: string }).botAccessToken = '';
      const unsub = adapter.onInboundMessage(() => {});
      expect(typeof unsub).toBe('function');
      unsub();
      adapter.stop();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('stop() 清理 syncTimer 不抛错', () => {
      const adapter = makeAdapter();
      expect(() => adapter.stop()).not.toThrow();
    });
  });
});
