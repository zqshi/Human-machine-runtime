import { describe, it, expect, vi } from 'vitest';
import { LlmKeySyncService } from './llm-key-sync-service.js';

function makeService(opts: {
  litellmConfigured?: boolean;
  models?: { id: number; modelName: string | null; providerModelName: string | null; displayName: string }[];
  grantsByInstance?: Record<string, number[]>;
}) {
  const aiGatewayRepo = {
    listModels: vi.fn().mockResolvedValue(
      opts.models ?? [{ id: 1, modelName: 'claude-sonnet-4-6', providerModelName: null, displayName: 'Claude' }]
    ),
    listGrantsByInstance: vi.fn().mockImplementation(async (id: string) => opts.grantsByInstance?.[id] ?? []),
    upsertInstanceKey: vi.fn().mockResolvedValue({ instanceId: 'inst-1' }),
    deleteInstanceKey: vi.fn().mockResolvedValue(true),
    getInstanceKey: vi.fn().mockResolvedValue(null),
  };
  const litellmClient = {
    isConfigured: () => opts.litellmConfigured ?? true,
    generateKey: vi.fn().mockResolvedValue({ key: 'sk-virtual-xxx', key_id: 'kid-1' }),
    deleteKey: vi.fn().mockResolvedValue({ deleted_keys: [] }),
  };
  const svc = new LlmKeySyncService({ aiGatewayRepo, litellmClient: litellmClient as never });
  return { svc, aiGatewayRepo, litellmClient };
}

describe('LlmKeySyncService', () => {
  it('有授权 + litellm 可用：生成 key 并 upsert', async () => {
    const { svc, aiGatewayRepo, litellmClient } = makeService({
      grantsByInstance: { 'inst-1': [1] },
    });
    const r = await svc.syncInstance('inst-1', 'tnt-1');
    expect(r.status).toBe('synced');
    expect(r.allowedModels).toEqual(['claude-sonnet-4-6']);
    expect(litellmClient.generateKey).toHaveBeenCalledWith(
      expect.objectContaining({ models: ['claude-sonnet-4-6'], teamId: 'tnt-1' })
    );
    expect(aiGatewayRepo.upsertInstanceKey).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: 'inst-1', litellmKey: 'sk-virtual-xxx', syncStatus: 'synced' })
    );
  });

  it('无授权：吊销并删除 key', async () => {
    const { svc, aiGatewayRepo } = makeService({ grantsByInstance: { 'inst-1': [] } });
    const r = await svc.syncInstance('inst-1', 'tnt-1');
    expect(r.status).toBe('skipped');
    expect(aiGatewayRepo.deleteInstanceKey).not.toHaveBeenCalled(); // 无旧 key
  });

  it('litellm 未配置：skip，不生成 key', async () => {
    const { svc, litellmClient } = makeService({
      litellmConfigured: false,
      grantsByInstance: { 'inst-1': [1] },
    });
    const r = await svc.syncInstance('inst-1', 'tnt-1');
    expect(r.status).toBe('skipped');
    expect(litellmClient.generateKey).not.toHaveBeenCalled();
  });

  it('生成 key 失败：记 failed，不抛错', async () => {
    const { svc, aiGatewayRepo, litellmClient } = makeService({
      grantsByInstance: { 'inst-1': [1] },
    });
    litellmClient.generateKey.mockRejectedValue(new Error('master key forbidden'));
    const r = await svc.syncInstance('inst-1', 'tnt-1');
    expect(r.status).toBe('failed');
    expect(aiGatewayRepo.upsertInstanceKey).toHaveBeenCalledWith(
      expect.objectContaining({ syncStatus: 'failed', lastError: 'master key forbidden' })
    );
  });
});
