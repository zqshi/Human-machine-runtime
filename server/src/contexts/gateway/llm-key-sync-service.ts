/**
 * LlmKeySyncService —— 将 instance 的模型授权同步为 LiteLLM virtual key。
 *
 * 当某 instance 的 grants（白名单）变更时，计算其被授权的全部模型别名，
 * 在 LiteLLM 生成/更新一把绑定 allowed_models 的 key，缓存到 instance_llm_keys。
 * chat.ts 调用时用该 key，实现 per-instance 模型隔离（LiteLLM 层兜底）。
 *
 * 设计原则：
 * - 同步失败不阻断主流程（grants 仍写入成功），仅记录 sync_status=failed。
 * - LiteLLM 未配置时跳过生成，但仍记录 stale 供后续补同步。
 * - revoke 已无授权的 instance（grants 清空）时删除其 key。
 */
import type { AiGatewayRepository } from '../../db/repositories/ai-gateway-repository.js';
import type { LiteLLMClient } from './clients/litellm-client.js';
import { logger } from '../../app/logger.js';

export interface LlmKeySyncDeps {
  aiGatewayRepo: Pick<
    AiGatewayRepository,
    'listModels' | 'listGrantsByInstance' | 'upsertInstanceKey' | 'deleteInstanceKey' | 'getInstanceKey'
  >;
  litellmClient: LiteLLMClient | null;
}

export interface SyncResult {
  instanceId: string;
  status: 'synced' | 'skipped' | 'failed';
  allowedModels: string[];
  message?: string;
}

export class LlmKeySyncService {
  constructor(private deps: LlmKeySyncDeps) {}

  /** 同步单个 instance 的 key（grants 变更后调用） */
  async syncInstance(instanceId: string, tenantId: string): Promise<SyncResult> {
    return this.syncOne(instanceId, tenantId);
  }

  /** 批量同步多个 instance（grants 变更后并行触发） */
  async syncInstances(instanceIds: string[], tenantId: string): Promise<SyncResult[]> {
    if (instanceIds.length === 0) return [];
    return Promise.all(instanceIds.map((id) => this.syncOne(id, tenantId)));
  }

  private async syncOne(instanceId: string, tenantId: string): Promise<SyncResult> {
    const { aiGatewayRepo, litellmClient } = this.deps;

    // 1. 计算该 instance 被授权的模型别名
    const [modelIds, allModels] = await Promise.all([
      aiGatewayRepo.listGrantsByInstance(instanceId),
      aiGatewayRepo.listModels(),
    ]);
    const allowed = allModels
      .filter((m) => modelIds.includes(m.id))
      .map((m) => m.modelName || m.providerModelName || m.displayName)
      .filter((m): m is string => !!m);

    // 2. 无授权 → 吊销并删除 key（默认关闭语义）
    if (allowed.length === 0) {
      const existing = await aiGatewayRepo.getInstanceKey(instanceId);
      if (existing) {
        await this.revokeKey(existing.litellmKey, existing.litellmKeyId);
        await aiGatewayRepo.deleteInstanceKey(instanceId);
      }
      return { instanceId, status: 'skipped', allowedModels: [], message: 'no grants, key revoked' };
    }

    // 3. LiteLLM 未配置 → 记 stale，待后续补同步
    if (!litellmClient || !litellmClient.isConfigured()) {
      logger.warn({ instanceId }, '[key-sync] litellm not configured, key skipped');
      return { instanceId, status: 'skipped', allowedModels: allowed, message: 'litellm not configured' };
    }

    // 4. 生成新 key（先吊销旧 key 再生成，保证 allowed_models 干净更新）
    try {
      const existing = await aiGatewayRepo.getInstanceKey(instanceId);
      if (existing) {
        await this.revokeKey(existing.litellmKey, existing.litellmKeyId);
      }
      const generated = await litellmClient.generateKey({
        teamId: tenantId,
        models: allowed,
        keyAlias: `instance:${instanceId}`,
        metadata: { instanceId, tenantId, source: 'clawdeck-key-sync' },
      });
      await aiGatewayRepo.upsertInstanceKey({
        instanceId,
        tenantId,
        litellmKey: generated.key,
        litellmKeyId: generated.key_id ?? null,
        allowedModels: allowed,
        syncStatus: 'synced',
      });
      return { instanceId, status: 'synced', allowedModels: allowed };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ instanceId, err: msg }, '[key-sync] generate key failed');
      await aiGatewayRepo.upsertInstanceKey({
        instanceId,
        tenantId,
        litellmKey: '',
        allowedModels: allowed,
        syncStatus: 'failed',
        lastError: msg,
      }).catch(() => {});
      return { instanceId, status: 'failed', allowedModels: allowed, message: msg };
    }
  }

  private async revokeKey(key: string, keyId: string | null): Promise<void> {
    const { litellmClient } = this.deps;
    if (!litellmClient || !litellmClient.isConfigured()) return;
    try {
      await litellmClient.deleteKey([keyId || key]);
    } catch (err) {
      // 吊销失败不阻断（旧 key 可能已过期）；仅记录
      logger.warn({ keyId, err: err instanceof Error ? err.message : String(err) }, '[key-sync] revoke failed (non-blocking)');
    }
  }

  /** 吊销某 instance 的 key（instance 删除/停用时） */
  async revokeInstance(instanceId: string): Promise<void> {
    const existing = await this.deps.aiGatewayRepo.getInstanceKey(instanceId);
    if (!existing) return;
    await this.revokeKey(existing.litellmKey, existing.litellmKeyId);
    await this.deps.aiGatewayRepo.deleteInstanceKey(instanceId);
  }
}
