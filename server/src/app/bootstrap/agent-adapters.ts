/**
 * Agent Runtime Adapter 依赖组装(执行引擎注册 + 任务完成回调)。
 *
 * 从 `bootstrap.ts` 拆出:AgentRuntimeAdapterRegistry + ClaudeAgentSdkAdapter(条件,
 * config.claude.apiKey)。实例任务真执行走 tool-loop(在 bootstrap.ts 注册,经 LiteLLM
 * 国产模型+registry.invoke 真闭环,替代已注销的 CockpitAdapter 假桩)。onTaskComplete
 * 闭包捕获 receiptManager/tokenUsageService/billingService(由 runtime-engine 产出,
 * 作为输入注入),用于任务完成后回执 + token 用量入账 + billing 记账。
 */
import { config } from '../../config/index.js';
import { Database } from '../../db/client.js';
import { logger } from '../logger.js';
import { appEventBus } from '../../shared/event-bus.js';
import { AgentRuntimeAdapterRegistry } from '../../contexts/agent-core/sandbox/adapter-registry.js';
import { ClaudeAgentSdkAdapter } from '../../contexts/agent-core/sandbox/claude-agent-sdk-adapter.js';
import { DockerWorkerRunner } from '../../contexts/agent-core/sandbox/infrastructure/docker-worker-runner.js';
import { DbInstanceSessionStore } from '../../contexts/agent-core/sandbox/infrastructure/instance-session-store.js';
import { estimateCostUsd } from '../../contexts/agent-core/domain/pricing.js';
import type { ReceiptManager } from '../../contexts/runtime-engine/receipt-manager.js';
import type { TokenUsageService } from '../../contexts/observability/token-usage-service.js';
import type { BillingService } from '../../contexts/billing/billing-service.js';
import type { ClusterInstanceClient } from '../../contexts/gateway/clients/cluster-instance-client.js';

export interface AgentAdapters {
  agentAdapterRegistry: AgentRuntimeAdapterRegistry;
}

export function buildAgentAdapters(
  db: Database,
  receiptManager: ReceiptManager,
  tokenUsageService: TokenUsageService,
  billingService: BillingService,
  clusterInstanceClient: ClusterInstanceClient
): AgentAdapters {
  const agentAdapterRegistry = new AgentRuntimeAdapterRegistry();
  // CockpitAdapter 假桩(simulateProgress)已注销——实例任务真执行走 tool-loop
  // (在 bootstrap.ts 注册,经 LiteLLM 国产模型+registry.invoke 真闭环)。假桩不应共存投产。
  // clusterInstanceClient 保留入参(未来真 cockpit runtime 接入时用),当前未消费。
  void clusterInstanceClient;

  // Claude Agent SDK adapter(主执行引擎)。env 不配 ANTHROPIC_API_KEY 时跳过,
  // 系统降级到只有 tool-loop 的行为(worker 路径A 作可选增强)。
  if (config.claude.apiKey) {
    const claudeSessionStore = new DbInstanceSessionStore(db);
    const claudeWorkerRunner = new DockerWorkerRunner();
    const claudeAdapter = new ClaudeAgentSdkAdapter(claudeWorkerRunner, claudeSessionStore, {
      apiKey: config.claude.apiKey,
      anthropicBaseUrl: config.claude.anthropicBaseUrl,
      workerImage: config.claude.workerImage,
      workerTimeoutMs: config.claude.workerTimeoutMs,
      workspaceRoot: config.claude.workspaceRoot,
      defaultModel: config.claude.defaultModel,
      defaultMaxTurns: config.claude.defaultMaxTurns,
      defaultBudgetUsd: config.claude.defaultBudgetUsd,
      internalToolSecret: config.claude.internalToolSecret,
      workerCallbackBaseUrl: config.claude.workerCallbackBaseUrl,
    });
    agentAdapterRegistry.register(claudeAdapter);

    claudeAdapter.onTaskComplete((result) => {
      const receipt = receiptManager.getReceipt(result.taskId);
      // token 用量入账(无论 receipt 是否存在,usage 都是真实 LLM 消耗)
      if (result.success && result.tokenUsage) {
        const tenantIdForUsage = receipt?.tenantId ?? 'unknown';
        tokenUsageService
          .recordUsage({
            tenantId: tenantIdForUsage,
            model: result.tokenUsage.model,
            inputTokens: result.tokenUsage.prompt,
            outputTokens: result.tokenUsage.completion,
            source: 'claude-agent-sdk',
          })
          .catch((err) => logger.warn({ err: String(err) }, 'claude token usage record failed'));
        // billing 记账:按定价表估算 USD 成本,落入 billing_events + 累加账户余额
        const costUsd = estimateCostUsd(
          result.tokenUsage.model,
          result.tokenUsage.prompt,
          result.tokenUsage.completion
        );
        if (costUsd > 0) {
          billingService
            .recordEvent({
              tenantId: tenantIdForUsage,
              type: 'token_usage',
              amount: costUsd,
              metadata: {
                model: result.tokenUsage.model,
                inputTokens: result.tokenUsage.prompt,
                outputTokens: result.tokenUsage.completion,
                taskId: result.taskId,
                source: 'claude-agent-sdk',
              },
            })
            .catch((err) => logger.warn({ err: String(err) }, 'claude billing record failed'));
        }
      }
      if (!receipt) return;
      if (result.success) {
        receiptManager
          .sendSuccessReceipt(receipt.id, receipt.summary, JSON.stringify(result.output))
          .catch((err) => logger.warn({ err: String(err) }, 'claude receipt send failed'));
      } else {
        receiptManager
          .sendFailureReceipt(receipt.id, receipt.summary, result.error ?? 'claude task failed')
          .catch((err) => logger.warn({ err: String(err) }, 'claude receipt send failed'));
      }
      appEventBus.publish('receipt:sent', {
        receiptId: result.taskId,
        taskId: result.taskId,
        channel: receipt.originChannel ?? 'unknown',
        success: result.success,
      });
    });
  }

  return { agentAdapterRegistry };
}
