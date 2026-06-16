/**
 * ModelGrantChecker —— 模型授权白名单校验。
 *
 * 校验「某数字员工实例(instance)是否被授权使用某模型(model)」。
 * 授权关系存于 instance_model_grants 表（白名单语义，默认关闭）。
 *
 * 灰度模式（由 SystemConfigService.aiGateway.enforceModelGrants 控制）：
 * - off:      不校验，直接放行（兼容现状的默认值）
 * - log:      校验并记录未授权调用，仍放行（可观测期）
 * - enforce:  校验并拒绝未授权调用（强制期）
 *
 * 调用方在发起 LLM 调用前调用 check()，依据返回 decision 决定放行或 403。
 */
import type { AiGatewayRepository } from '../../db/repositories/ai-gateway-repository.js';
import type { SystemConfigService } from '../system-config/system-config-service.js';
import { logger } from '../../app/logger.js';

export type EnforceMode = 'off' | 'log' | 'enforce';

export interface GrantDecision {
  /** allow: 放行；deny: 拒绝；skip: 未启用校验或缺少依据，放行 */
  decision: 'allow' | 'deny' | 'skip';
  reason: string;
  enforceMode: EnforceMode;
  modelId: number | null;
}

/** ModelGrantChecker 所需的最小依赖（便于测试 mock） */
export interface ModelGrantCheckerDeps {
  aiGatewayRepo: Pick<AiGatewayRepository, 'listModels' | 'listGrantsByModel'>;
  systemConfigService: Pick<SystemConfigService, 'getAiGatewayEnforceMode'>;
}

export class ModelGrantChecker {
  constructor(private deps: ModelGrantCheckerDeps) {}

  /**
   * 校验某 instance 是否被授权使用某模型。
   *
   * @param instanceId 数字员工实例 id；为空表示统一助手/无具体 instance，跳过校验
   * @param modelName  请求的模型名（LiteLLM 别名或 providerModelName）
   */
  async check(instanceId: string | null | undefined, modelName: string): Promise<GrantDecision> {
    const enforceMode = await this.deps.systemConfigService.getAiGatewayEnforceMode();

    // 未启用：放行
    if (enforceMode === 'off') {
      return { decision: 'skip', reason: 'enforce off', enforceMode, modelId: null };
    }

    // 无 instance 上下文（统一助手等）：跳过，不约束平台级调用
    if (!instanceId) {
      return { decision: 'skip', reason: 'no instance context', enforceMode, modelId: null };
    }

    // 解析 modelName → modelId
    const modelId = await this.resolveModelId(modelName);
    if (modelId === null) {
      // 模型未在治理表登记：放行（未纳入授权治理的模型不受约束）
      return {
        decision: 'skip',
        reason: `model not registered: ${modelName}`,
        enforceMode,
        modelId: null,
      };
    }

    const granted = await this.deps.aiGatewayRepo.listGrantsByModel(modelId);
    const authorized = granted.includes(instanceId);

    if (authorized) {
      return { decision: 'allow', reason: 'granted', enforceMode, modelId };
    }

    // 未授权
    const reason = `instance ${instanceId} not granted for model ${modelName}(${modelId})`;
    if (enforceMode === 'log') {
      logger.warn({ instanceId, modelName, modelId }, '[model-grant] unauthorized (log mode)');
      return { decision: 'allow', reason: `${reason} (log mode)`, enforceMode, modelId };
    }
    // enforce
    logger.warn({ instanceId, modelName, modelId }, '[model-grant] unauthorized (denied)');
    return { decision: 'deny', reason, enforceMode, modelId };
  }

  /** 匹配 modelName 别名或 providerModelName → modelId；未命中返回 null */
  private async resolveModelId(modelName: string): Promise<number | null> {
    const models = await this.deps.aiGatewayRepo.listModels();
    const hit = models.find(
      (m) => m.modelName === modelName || m.providerModelName === modelName || m.displayName === modelName
    );
    return hit?.id ?? null;
  }
}
