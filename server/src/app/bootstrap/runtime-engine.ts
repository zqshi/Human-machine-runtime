/**
 * Runtime Engine 依赖组装(消息处理管线 + LLM 客户端 + 用量/计费)。
 *
 * 从 `bootstrap.ts` 拆出:InboundPipeline(含 normalize/dedup/priority/score→recommend→
 * decision 闭包)+ agentSession + agentLlmClient + channelService + receiptManager
 * + tokenUsageService + billingService。tokenUsageService/billingService 提前实例化,
 * 供 agent-adapters 的 onTaskComplete 闭包捕获(返回给主函数注入)。
 *
 * agentSession/agentLlmClient 返回给主函数,用于后续构造 agentHarness/agentCore。
 */
import { config } from '../../config/index.js';
import { Database } from '../../db/client.js';
import { logger } from '../logger.js';
import { appEventBus } from '../../shared/event-bus.js';
import { InboundPipeline } from '../../contexts/channel/inbound-pipeline.js';
import { MessageNormalizer } from '../../contexts/runtime-engine/message-normalizer.js';
import { DedupEngine } from '../../contexts/runtime-engine/dedup-engine.js';
import { PriorityScorer } from '../../contexts/runtime-engine/priority-scorer.js';
import { RecommendationEngine } from '../../contexts/runtime-engine/recommendation-engine.js';
import { projectDecision } from '../../contexts/runtime-engine/decision-projector.js';
import { SessionStore } from '../../contexts/agent-core/session/session-store.js';
import { LiteLlmClientAdapter } from '../../contexts/agent-core/harness/litellm-llm-client.js';
import { ReceiptManager } from '../../contexts/runtime-engine/receipt-manager.js';
import { TokenUsageService } from '../../contexts/observability/token-usage-service.js';
import { BillingRepository } from '../../db/repositories/billing-repository.js';
import { BillingService } from '../../contexts/billing/billing-service.js';
import { buildChannelService } from './channel-service.js';
import type { ChannelService } from '../../contexts/channel/channel-service.js';
import type { ContainerOrchestratorClient } from '../../contexts/gateway/clients/container-orchestrator-client.js';
import type { LiteLLMClient } from '../../contexts/gateway/clients/litellm-client.js';
import type { ProfileServiceClient } from '../../contexts/gateway/clients/profile-service-client.js';
import type { TokenUsageRepository } from '../../db/repositories/token-usage-repository.js';

export interface RuntimeEngine {
  channelService: ChannelService;
  receiptManager: ReceiptManager;
  tokenUsageService: TokenUsageService;
  billingService: BillingService;
  agentSession: SessionStore;
  agentLlmClient: LiteLlmClientAdapter;
  recommendationEngine: RecommendationEngine;
  messageNormalizer: MessageNormalizer;
  dedupEngine: DedupEngine;
  priorityScorer: PriorityScorer;
}

export function buildRuntimeEngine(
  db: Database,
  containerOrchestratorClient: ContainerOrchestratorClient,
  litellmClient: LiteLLMClient,
  profileServiceClient: ProfileServiceClient,
  tokenUsageRepo: TokenUsageRepository
): RuntimeEngine {
  const inboundPipeline = new InboundPipeline();

  const messageNormalizer = new MessageNormalizer();
  const dedupEngine = new DedupEngine();
  const priorityScorer = new PriorityScorer();
  // agentSession 提前实例化,inboundPipeline 闭包需引用 recordDecision。
  const agentSession = new SessionStore(db);
  // 提前实例化 agentLlmClient,供 RecommendationEngine + agentHarness 共享。
  // recentDecisionsProvider 暂不接入(provider 需要 agentSession 已构造,避免循环依赖)
  const agentLlmClient = new LiteLlmClientAdapter(litellmClient, config.agent.llmModel);
  const recommendationEngine = new RecommendationEngine(agentLlmClient);

  inboundPipeline.use(async (msg) => {
    const normalized = messageNormalizer.normalize(msg);
    const dedupResult = dedupEngine.check(normalized);
    if (dedupResult.isDuplicate) {
      logger.debug({ msgId: msg.id, originalId: dedupResult.originalMessageId }, 'message deduped');
      return;
    }
    const priority = priorityScorer.score(normalized);
    appEventBus.publish('runtime:message-scored', {
      messageId: normalized.id,
      intent: normalized.intent,
      urgency: normalized.urgency,
      score: priority.score,
      channelType: normalized.channelType,
    });

    if (priority.score >= 60) {
      const recResult = await recommendationEngine.generateRecommendations({
        triggeredBy: normalized,
        relatedMessages: [],
        historicalDecisions: [],
        dataPoints: [],
      });
      appEventBus.publish('runtime:recommendation', {
        messageId: normalized.id,
        recommendations: recResult.recommendations,
      });
      // 把首选推荐投影为待确认 Decision 落库（消息→决策运行时闭环）
      const primary = recResult.recommendations[0];
      if (primary) {
        const decision = projectDecision(
          { message: normalized, recommendation: primary },
          Date.now()
        );
        agentSession.recordDecision(decision);
      }
    }
  });

  const channelService = buildChannelService(containerOrchestratorClient, inboundPipeline);
  const receiptManager = new ReceiptManager(channelService);

  /* tokenUsageService:claudeAdapter.onTaskComplete 回调闭包捕获 */
  const tokenUsageService = new TokenUsageService(
    profileServiceClient,
    litellmClient,
    tokenUsageRepo
  );

  /* billingService:claudeAdapter.onTaskComplete 记账闭包捕获 */
  const billingRepo = new BillingRepository(db);
  const billingService = new BillingService(billingRepo);

  return {
    channelService,
    receiptManager,
    tokenUsageService,
    billingService,
    agentSession,
    agentLlmClient,
    recommendationEngine,
    messageNormalizer,
    dedupEngine,
    priorityScorer,
  };
}
