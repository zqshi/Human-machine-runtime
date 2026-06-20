import { describe, it, expect, vi } from 'vitest';
import { WpsChannelAdapter } from './wps-adapter.js';
import type { ContainerOrchestratorClient } from '../../gateway/clients/container-orchestrator-client.js';

function makeFarmClient(configured = true): ContainerOrchestratorClient {
  return {
    isConfigured: vi.fn(() => configured),
    sendMessage: vi.fn(async () => ({})),
    listChannels: vi.fn(async () => [
      { id: 'ch_1', name: 'WPS 研发群' },
      { id: 'ch_2', name: 'WPS 产品群' },
    ]),
  } as unknown as ContainerOrchestratorClient;
}

describe('WpsChannelAdapter', () => {
  it('has channelType "wps"', () => {
    const adapter = new WpsChannelAdapter(makeFarmClient());
    expect(adapter.channelType).toBe('wps');
  });

  it('sendMessage delegates to ContainerOrchestratorClient', async () => {
    const client = makeFarmClient();
    const adapter = new WpsChannelAdapter(client);

    await adapter.sendMessage(
      { channelType: 'wps', roomId: 'room_1' },
      { content: 'hello', type: 'text' }
    );

    expect(client.sendMessage).toHaveBeenCalledWith('room_1', {
      content: 'hello',
      type: 'text',
      replyTo: undefined,
    });
  });

  it('sendMessage maps card type', async () => {
    const client = makeFarmClient();
    const adapter = new WpsChannelAdapter(client);

    await adapter.sendMessage(
      { channelType: 'wps', roomId: 'r' },
      { content: '{}', type: 'card', metadata: { replyTo: 'msg_prev' } }
    );

    expect(client.sendMessage).toHaveBeenCalledWith('r', {
      content: '{}',
      type: 'card',
      replyTo: 'msg_prev',
    });
  });

  it('getStatus returns connected when farm client works', async () => {
    const adapter = new WpsChannelAdapter(makeFarmClient());
    const status = await adapter.getStatus();
    expect(status).toEqual({ channelType: 'wps', connected: true });
  });

  it('getStatus returns disconnected when farm not configured', async () => {
    const adapter = new WpsChannelAdapter(makeFarmClient(false));
    const status = await adapter.getStatus();
    expect(status.connected).toBe(false);
    expect(status.error).toContain('not configured');
  });

  it('getStatus catches upstream errors', async () => {
    const client = makeFarmClient();
    (client.listChannels as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('timeout'));
    const adapter = new WpsChannelAdapter(client);
    const status = await adapter.getStatus();
    expect(status.connected).toBe(false);
    expect(status.error).toBe('timeout');
  });

  it('listConversations maps container-orchestrator channels', async () => {
    const adapter = new WpsChannelAdapter(makeFarmClient());
    const convos = await adapter.listConversations('user_1');
    expect(convos).toHaveLength(2);
    expect(convos[0]).toEqual({ id: 'ch_1', channelType: 'wps', name: 'WPS 研发群' });
  });

  it('listConversations returns empty when not configured', async () => {
    const adapter = new WpsChannelAdapter(makeFarmClient(false));
    const convos = await adapter.listConversations('user_1');
    expect(convos).toEqual([]);
  });

  it('listConversations returns empty on error', async () => {
    const client = makeFarmClient();
    (client.listChannels as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('fail'));
    const adapter = new WpsChannelAdapter(client);
    const convos = await adapter.listConversations('user_1');
    expect(convos).toEqual([]);
  });
});
