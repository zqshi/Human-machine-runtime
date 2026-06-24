import { pool, type Database } from '../db/client.js';
import { config } from '../config/index.js';
import { logger } from './logger.js';
import { appEventBus } from '../shared/event-bus.js';
import { encrypt, decrypt } from '../contexts/credential-vault/crypto.js';

// 拆分出的子模块
import type { AppContext } from './bootstrap/types.js';
import { buildGatewayClients } from './bootstrap/gateway-clients.js';
import { buildCredentialBundle } from './bootstrap/credentials.js';
import { buildRagProvider } from './bootstrap/rag-provider.js';
import { buildAssemblyProvider } from './bootstrap/assembly-provider.js';
import { buildTraceRecorder } from './bootstrap/trace-recorder.js';
import { EvalAgentInvoker } from './bootstrap/eval-agent-invoker.js';
import { AgentDefinitionRepository } from '../db/repositories/agent-definition-repository.js';
import { createMatrixBotLogger, createMatrixBotDeps } from './bootstrap/matrix-adapters.js';

// 类型重新导出,保持现有 `import type { AppContext } from '../app/bootstrap.js'` 调用方不破坏
export type { AppContext } from './bootstrap/types.js';

import { UserRepository } from '../db/repositories/user-repository.js';
import { TenantRepository } from '../db/repositories/tenant-repository.js';
import { AuditRepository } from '../db/repositories/audit-repository.js';
import { SkillRepository } from '../db/repositories/skill-repository.js';
import { InstanceRepository } from '../db/repositories/instance-repository.js';
import { DocumentRepository } from '../db/repositories/document-repository.js';
import { AiGatewayRepository } from '../db/repositories/ai-gateway-repository.js';
import { ConfigRepository } from '../db/repositories/config-repository.js';

import { AuthService } from '../contexts/identity-access/auth-service.js';
import { AuthProviderRegistry } from '../contexts/identity-access/auth-provider-registry.js';
import { LocalAuthProvider } from '../contexts/identity-access/providers/local-provider.js';
import { OIDCAuthProvider } from '../contexts/identity-access/providers/oidc-provider.js';
import { PlatformBeProxyProvider } from '../contexts/identity-access/providers/platform-be-proxy-provider.js';
import { WpsOAuthProvider } from '../contexts/identity-access/providers/wps-oauth-provider.js';
import { DrizzleSessionStore } from '../contexts/identity-access/session-store.js';
import { TenantService } from '../contexts/tenant-management/tenant-service.js';
import { AuditService } from '../contexts/audit-observability/audit-service.js';
import { SkillService } from '../contexts/shared-assets/skill-service.js';
import { InstanceService } from '../contexts/tenant-instance/instance-service.js';
import { ModelGrantChecker } from '../contexts/gateway/model-grant-checker.js';
import { LlmKeySyncService } from '../contexts/gateway/llm-key-sync-service.js';
import { DocumentService } from '../contexts/document/document-service.js';
import { ChannelService } from '../contexts/channel/channel-service.js';
import { MatrixChannelAdapter } from '../contexts/channel/adapters/matrix-adapter.js';
import { WpsChannelAdapter } from '../contexts/channel/adapters/wps-adapter.js';
import { WebSocketChannelAdapter } from '../contexts/channel/adapters/websocket-adapter.js';
import { DecisionConsole } from '../contexts/channel/decision-console.js';
import { ChannelRouter } from '../contexts/channel/channel-router.js';
import { ChannelRoutingRepository } from '../db/repositories/channel-routing-repository.js';
import { InboundPipeline } from '../contexts/channel/inbound-pipeline.js';
import { McpService } from '../contexts/mcp-management/mcp-service.js';
import { TokenUsageService } from '../contexts/observability/token-usage-service.js';

import { LocalProvisioner } from '../contexts/tenant-instance/provisioners/local-provisioner.js';
import { ContainerOrchestratorProvisioner } from '../contexts/tenant-instance/provisioners/container-orchestrator-provisioner.js';
import { CompositeProvisioner } from '../contexts/tenant-instance/provisioners/composite-provisioner.js';
import type { IInstanceProvisioner } from '../contexts/tenant-instance/instance-service.js';
import { MatrixBot } from '../integrations/matrix/matrix-bot.js';

import { ContainerOrchestratorWsBridge } from '../contexts/gateway/clients/container-orchestrator-ws-bridge.js';
// buildChannelService 函数签名需要 ContainerOrchestratorClient 类型注解,仅 type 导入
import type { ContainerOrchestratorClient } from '../contexts/gateway/clients/container-orchestrator-client.js';

import { WeKnoraClient } from '../contexts/gateway/clients/weknora-client.js';
import { WkMappingRepository } from '../db/repositories/weknora-mapping-repository.js';
import { KnowledgeBaseRepository } from '../db/repositories/knowledge-base-repository.js';
import { KnowledgeEntryRepository } from '../db/repositories/knowledge-entry-repository.js';
import { KnowledgeService } from '../contexts/knowledge/knowledge-service.js';

import { MarketplaceService } from '../contexts/marketplace/marketplace-service.js';
import { WorkspaceService } from '../contexts/workspace/workspace-service.js';
import { AgentProfileService } from '../contexts/agent-profile/agent-profile-service.js';
import { OpenclawRepository } from '../db/repositories/openclaw-repository.js';
import { OperationalRepository } from '../db/repositories/operational-repository.js';
import { WorkspaceRepository } from '../db/repositories/workspace-repository.js';
import { AgentProfileRepository } from '../db/repositories/agent-profile-repository.js';
import { TokenUsageRepository } from '../db/repositories/token-usage-repository.js';
import { AgentCore } from '../contexts/agent-core/agent-core.js';
import { SessionStore } from '../contexts/agent-core/session/session-store.js';
import { AgentHarness } from '../contexts/agent-core/harness/harness.js';
import { LiteLlmClientAdapter } from '../contexts/agent-core/harness/litellm-llm-client.js';
import { projectDecision } from '../contexts/runtime-engine/decision-projector.js';
import { AnalyticsService } from '../contexts/analytics/analytics-service.js';
import { UserManagementService } from '../contexts/identity-access/user-management-service.js';
import { SystemConfigService } from '../contexts/system-config/system-config-service.js';
import { NotificationService } from '../contexts/notification/notification-service.js';
import { ToolManagementService } from '../contexts/tool-management/tool-management-service.js';
import { ToolRegistryService } from '../contexts/tool-management/tool-registry-service.js';
import { McpClientPool } from '../contexts/tool-management/mcp-client.js';
import {
  ToolSourceRepository,
  ToolDefinitionRepository,
  ToolInstanceRepository,
  ToolCallLogRepository,
} from '../db/repositories/tool-registry-repository.js';
import { PushChannelService } from '../contexts/push-channel/push-channel-service.js';
import { SharedAgentService } from '../contexts/shared-agent/shared-agent-service.js';
import { GatewayHealth } from '../contexts/gateway/gateway-health.js';
import { QuotaRepository } from '../db/repositories/quota-repository.js';
import { PlanRepository } from '../db/repositories/plan-repository.js';
import { QuotaService } from '../contexts/quota-management/quota-service.js';
import { PlanService } from '../contexts/tenant-management/plan-service.js';
import { QuotaMonitor } from '../contexts/quota-management/quota-monitor.js';
import { TraceSyncJob } from '../contexts/observability/trace-sync-job.js';
import { EvalBenchmarkRepository } from '../db/repositories/eval-benchmark-repository.js';
import { EvalEvaluatorRepository } from '../db/repositories/eval-evaluator-repository.js';
import { EvalService } from '../contexts/eval-benchmark/eval-service.js';
import { EmployeeMemoryRepository } from '../db/repositories/employee-memory-repository.js';
import { MemoryService } from '../contexts/employee-memory/memory-service.js';
import { Mem0Client } from '../contexts/employee-memory/mem0-client.js';
import { DepartmentRepository } from '../db/repositories/department-repository.js';
import { DepartmentService } from '../contexts/department/department-service.js';
import { ScheduledTaskRepository } from '../db/repositories/scheduled-task-repository.js';
import { SchedulerService } from '../contexts/scheduler/scheduler-service.js';
import { JobHandlerRegistry } from '../contexts/scheduler/job-handler-registry.js';
import { CronExpressionCalculator } from '../contexts/scheduler/cron-calculator.js';
import { PgAdvisoryLockProvider } from '../contexts/scheduler/pg-advisory-lock.js';
import {
  SystemJobHandler,
  registerTraceCleanup,
} from '../contexts/scheduler/handlers/system-handler.js';
import { AgentJobHandler } from '../contexts/scheduler/handlers/agent-handler.js';
import { LlmAgentInvoker } from '../contexts/scheduler/handlers/llm-agent-invoker.js';
import { registerEmployeeCleanup } from '../contexts/scheduler/handlers/employee-cleanup.js';
import { registerWeeklyReport } from '../contexts/scheduler/handlers/weekly-report.js';
import { registerInstanceHealthMonitor } from '../contexts/scheduler/handlers/instance-health-monitor.js';
import { registerInstanceReconciler } from '../contexts/scheduler/handlers/instance-reconciler.js';
import {
  ensureSchedulerTasks,
  BOOTSTRAP_SCHEDULER_TASKS,
} from '../contexts/scheduler/bootstrap-tasks.js';
import { DbOAuthStateRepository } from '../db/repositories/oauth-state-repository.js';
import type { IOAuthStateStore } from '../contexts/identity-access/oauth-state-store.js';
import { registerOAuthStateCleanup } from '../contexts/scheduler/handlers/oauth-state-cleanup.js';
import { InstanceHealthRepository } from '../db/repositories/instance-health-repository.js';
import { BillingRepository } from '../db/repositories/billing-repository.js';
import { BillingService } from '../contexts/billing/billing-service.js';
import { estimateCostUsd } from '../contexts/agent-core/domain/pricing.js';

import { MessageNormalizer } from '../contexts/runtime-engine/message-normalizer.js';
import { PriorityScorer } from '../contexts/runtime-engine/priority-scorer.js';
import { DedupEngine } from '../contexts/runtime-engine/dedup-engine.js';
import { RecommendationEngine } from '../contexts/runtime-engine/recommendation-engine.js';
import { ReceiptManager } from '../contexts/runtime-engine/receipt-manager.js';
import { AgentRuntimeAdapterRegistry } from '../contexts/agent-core/sandbox/adapter-registry.js';
import { OpenClawAdapter } from '../contexts/agent-core/sandbox/openclaw-adapter.js';
import { ClaudeAgentSdkAdapter } from '../contexts/agent-core/sandbox/claude-agent-sdk-adapter.js';
import { DockerWorkerRunner } from '../contexts/agent-core/sandbox/infrastructure/docker-worker-runner.js';
import { DbInstanceSessionStore } from '../contexts/agent-core/sandbox/infrastructure/instance-session-store.js';

function buildAuthProviderRegistry(userRepo: UserRepository): AuthProviderRegistry {
  const registry = new AuthProviderRegistry(config.auth.defaultProvider);

  const localProvider = new LocalAuthProvider(
    { findByUsername: (u) => userRepo.findLocalUser(u) },
    { allowPlainPassword: config.env === 'development' }
  );
  registry.register(localProvider);

  if (config.auth.oidc.issuer && config.auth.oidc.clientId) {
    const oidcProvider = new OIDCAuthProvider({
      issuer: config.auth.oidc.issuer,
      clientId: config.auth.oidc.clientId,
      clientSecret: config.auth.oidc.clientSecret,
      scopes: config.auth.oidc.scopes,
    });
    registry.register(oidcProvider);
  }

  if (config.auth.platformBe.baseUrl) {
    const platformBeProvider = new PlatformBeProxyProvider({
      baseUrl: config.auth.platformBe.baseUrl,
      timeout: config.gateway.timeoutMs,
      clientId: config.auth.platformBe.clientId,
      clientSecret: config.auth.platformBe.clientSecret,
      callbackUrl: config.auth.platformBe.callbackUrl,
    });
    registry.register(platformBeProvider);
  }

  if (config.auth.wpsOAuth.clientId && config.auth.wpsOAuth.clientSecret) {
    const wpsOAuthProvider = new WpsOAuthProvider({
      clientId: config.auth.wpsOAuth.clientId,
      clientSecret: config.auth.wpsOAuth.clientSecret,
      redirectUri: config.auth.wpsOAuth.redirectUri,
      scopes: config.auth.wpsOAuth.scopes,
    });
    registry.register(wpsOAuthProvider);
  }

  return registry;
}

function buildChannelService(
  containerOrchestratorClient: ContainerOrchestratorClient,
  pipeline?: InboundPipeline
): ChannelService {
  const channelService = new ChannelService();
  if (pipeline) channelService.setInboundPipeline(pipeline);
  channelService.registerAdapter(new MatrixChannelAdapter());
  channelService.registerAdapter(new WpsChannelAdapter(containerOrchestratorClient));
  channelService.registerAdapter(new WebSocketChannelAdapter());
  return channelService;
}

export function createAppContext(db: Database): AppContext {
  const userRepo = new UserRepository(db);
  const tenantRepo = new TenantRepository(db);
  const auditRepo = new AuditRepository(db);
  const skillRepo = new SkillRepository(db);
  const instanceRepo = new InstanceRepository(db);
  const departmentRepo = new DepartmentRepository(db);
  const departmentService = new DepartmentService(departmentRepo);
  const documentRepo = new DocumentRepository(db);
  const aiGatewayRepo = new AiGatewayRepository(db);
  const configRepo = new ConfigRepository(db);
  const openclawRepo = new OpenclawRepository(db);
  const operationalRepo = new OperationalRepository(db);
  const agentProfileRepo = new AgentProfileRepository(db);
  const tokenUsageRepo = new TokenUsageRepository(db);

  const auditService = new AuditService(auditRepo, {
    retentionTtlDays: 90,
    retentionMaxRows: 100_000,
  });

  const registry = buildAuthProviderRegistry(userRepo);
  const sessionStore = new DrizzleSessionStore(db);
  const authService = new AuthService([], userRepo, registry, sessionStore);

  const skillService = new SkillService(skillRepo, auditService);
  const documentService = new DocumentService(documentRepo, auditService);

  // credential-vault:加解密 + lease + 持久化 + 管理服务,统一从 buildCredentialBundle 组装(见 bootstrap/credentials.ts)
  const { credentialService, leaseService, credentialManagementService } =
    buildCredentialBundle(db);

  // 9 个外部服务 HTTP 客户端:统一从 buildGatewayClients 构造(见 bootstrap/gateway-clients.ts)
  const {
    marketplaceClient,
    profileServiceClient,
    workspaceBackendClient,
    containerOrchestratorClient,
    clusterInstanceClient,
    litellmClient,
  } = buildGatewayClients();

  /* ──── Provisioner: local + container-orchestrator composite ──── */
  const localProvisioner = new LocalProvisioner();
  const provisioners: IInstanceProvisioner[] = [localProvisioner];
  if (containerOrchestratorClient.isConfigured()) {
    provisioners.push(new ContainerOrchestratorProvisioner(containerOrchestratorClient));
  }
  const provisioner =
    provisioners.length > 1 ? new CompositeProvisioner(provisioners) : localProvisioner;

  const auditLogger = {
    log(event: {
      action: string;
      instanceId: string;
      tenantId: string;
      actor: string;
      detail?: Record<string, unknown>;
      timestamp: string;
    }) {
      auditService.log(
        event.action,
        { instanceId: event.instanceId, tenantId: event.tenantId, ...event.detail },
        { actor: { username: event.actor, role: 'system' } }
      );
    },
  };
  const instanceService = new InstanceService(instanceRepo, provisioner, auditLogger);

  const inboundPipeline = new InboundPipeline();

  /* ──── Runtime Engine: 消息处理管线 ──── */
  const messageNormalizer = new MessageNormalizer();
  const dedupEngine = new DedupEngine();
  const priorityScorer = new PriorityScorer();
  // agent-core 三层重构(D2-D5):Session(状态)/Harness(编排)/Sandbox(执行)。
  // agentSession 提前实例化,inboundPipeline 闭包需引用 recordDecision。
  // agentHarness / agentCore 在 agentAdapterRegistry 构造完成后组装(下方)。
  const agentSession = new SessionStore(db);
  // 提前实例化 agentLlmClient,供 RecommendationEngine + agentHarness 共享。
  // recentDecisionsProvider 暂不接入(provider 需要 agentSession 已构造,
  // 避免循环依赖,留待后续按需补齐)
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

  /* tokenUsageService 提前实例化:claudeAdapter.onTaskComplete 回调闭包需要捕获它 */
  const tokenUsageService = new TokenUsageService(
    profileServiceClient,
    litellmClient,
    tokenUsageRepo
  );

  /* billingService 提前实例化:claudeAdapter.onTaskComplete 记账闭包需要捕获它 */
  const billingRepo = new BillingRepository(db);
  const billingService = new BillingService(billingRepo);

  /* ──── AgentRuntimeAdapter Registry ──── */
  const agentAdapterRegistry = new AgentRuntimeAdapterRegistry();
  const openClawAdapter = new OpenClawAdapter(clusterInstanceClient);
  agentAdapterRegistry.register(openClawAdapter);

  // Claude Agent SDK adapter(主执行引擎)。env 不配 ANTHROPIC_API_KEY 时跳过,
  // 系统降级到只有 OpenClaw 的旧行为。
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

  openClawAdapter.onTaskComplete((result) => {
    const receipt = receiptManager.getReceipt(result.taskId);
    if (receipt) {
      if (result.success) {
        receiptManager
          .sendSuccessReceipt(receipt.id, receipt.summary, JSON.stringify(result.output))
          .catch((err) => logger.warn({ err: String(err) }, 'receipt send failed'));
      } else {
        receiptManager
          .sendFailureReceipt(
            receipt.id,
            receipt.summary,
            (result.output?.error as string) ?? 'unknown error'
          )
          .catch((err) => logger.warn({ err: String(err) }, 'receipt send failed'));
      }
    }
    appEventBus.publish('receipt:sent', {
      receiptId: result.taskId,
      taskId: result.taskId,
      channel: receipt?.originChannel ?? 'unknown',
      success: result.success,
    });
  });
  const channelRoutingRepo = new ChannelRoutingRepository(db);
  const channelRouter = new ChannelRouter(channelService, channelRoutingRepo);
  const decisionConsole = new DecisionConsole(channelService, channelRouter);
  const mcpService = new McpService(marketplaceClient);

  const marketplaceAudit = {
    log(type: string, payload: Record<string, unknown>) {
      auditService.log(type, payload);
    },
  };
  const marketplaceService = new MarketplaceService(marketplaceClient, marketplaceAudit);
  const workspaceRepo = new WorkspaceRepository(db);
  const workspaceService = new WorkspaceService(
    workspaceRepo,
    workspaceBackendClient,
    marketplaceClient,
    clusterInstanceClient
  );
  const agentProfileService = new AgentProfileService(profileServiceClient);

  // 注入真实 LLM（经 LiteLLM 路由）。agentLlmClient 已在 Runtime Engine 段提前实例化(供 RecommendationEngine 共享)。
  // llmModel 留空时 adapter.isAvailable=false，AgentExecutor 自动降级到关键词匹配。
  // agent-core 三层(D2-D5):Session 已提前实例化,Sandbox 用上面的 agentAdapterRegistry,
  // Harness 编排两者,AgentCore 作为 facade 暴露给 AppContext。
  const agentHarness = new AgentHarness(agentLlmClient, agentSession, agentAdapterRegistry);
  const agentCore = new AgentCore(agentSession, agentHarness, agentAdapterRegistry);

  const analyticsService = new AnalyticsService(db, aiGatewayRepo, instanceService);
  const userManagementService = new UserManagementService(userRepo);
  const systemConfigService = new SystemConfigService(configRepo);
  const modelGrantChecker = new ModelGrantChecker({
    aiGatewayRepo,
    systemConfigService,
  });
  const llmKeySyncService = new LlmKeySyncService({
    aiGatewayRepo,
    litellmClient,
  });
  const notificationService = new NotificationService(operationalRepo);
  const toolManagementService = new ToolManagementService(
    new ToolSourceRepository(db),
    new ToolDefinitionRepository(db),
    new ToolInstanceRepository(db),
    new ToolCallLogRepository(db),
    credentialService
  );
  const toolRegistryService = new ToolRegistryService(
    toolManagementService,
    new ToolSourceRepository(db),
    new McpClientPool(),
    notificationService,
    new PgAdvisoryLockProvider(pool)
  );
  // 激活 Agent 工具调用兜底（解决 toolRegistry 晚于 agentHarness 实例化的顺序问题）
  agentHarness.setToolRegistry(toolRegistryService);
  // P4: 定时工具健康检查（每 5 分钟探活各 source、维护 healthStatus、转 down 告警）。
  // 多实例并发已由 advisory lock（PgAdvisoryLockProvider, key=tool-health-check）兜底：
  // 同一时刻只有一个实例实际探活，其余跳过。
  setInterval(
    () => {
      void toolRegistryService.healthCheckAll().catch((err) => {
        logger.warn({ err: String(err) }, 'tool health check failed');
      });
    },
    5 * 60 * 1000
  );
  const pushChannelService = new PushChannelService(operationalRepo);
  const sharedAgentService = new SharedAgentService(
    instanceService,
    operationalRepo,
    marketplaceClient
  );

  /* ──── WeKnora Knowledge Service (条件启用) ──── */
  const wkMappingRepo = new WkMappingRepository(db);
  const weKnoraClient = config.weknora.enabled ? new WeKnoraClient() : null;

  const wkEncryption = {
    encrypt: (s: string) => encrypt(s, config.weknora.encryptionKey),
    decrypt: (s: string) => decrypt(s, config.weknora.encryptionKey),
  };

  const kbRepo = new KnowledgeBaseRepository(db);
  const entryRepo = new KnowledgeEntryRepository(db);

  const knowledgeService = weKnoraClient
    ? new KnowledgeService({
        client: weKnoraClient,
        mappingRepo: wkMappingRepo,
        kbRepo,
        entryRepo,
        encryption: wkEncryption,
      })
    : null;

  const tenantService = new TenantService(tenantRepo, knowledgeService ?? undefined);

  const planRepo = new PlanRepository(db);
  const planTenantChecker = {
    async countByPlan(planSlug: string) {
      const all = await tenantRepo.listTenants();
      return all.filter((t) => t.plan === planSlug).length;
    },
  };
  const planService = new PlanService(planRepo, planTenantChecker);

  const quotaRepo = new QuotaRepository(db);
  const quotaService = new QuotaService(
    quotaRepo,
    { getById: async (id: string) => tenantService.getById(id) },
    { list: async (tid?: string) => instanceService.list(tid) },
    {
      getUsageSummary: async (tid: string, period?: string) =>
        tokenUsageService.getUsageSummary(tid, period),
    }
  );

  /* ──── QuotaMonitor (定时配额评估) ──── */
  const quotaMonitorNotifier = {
    async notifyAlert(
      tenantId: string,
      alert: { resourceType: string; currentPct: number; thresholdPct: number; severity: string }
    ) {
      await notificationService.createFromAlert(tenantId, alert);
    },
  };
  const quotaMonitorTenantSource = {
    async listActiveTenantIds() {
      const tenants = await tenantService.list({ status: 'active' });
      return tenants.map((t) => t.id);
    },
  };
  const quotaMonitorInterval = config.env === 'development' ? 60_000 : 300_000;
  const quotaMonitor = new QuotaMonitor(
    quotaService,
    quotaMonitorTenantSource,
    quotaMonitorNotifier,
    quotaMonitorInterval
  );

  /* ──── TraceSyncJob (LiteLLM Spend Logs → ai_traces) ──── */
  const traceSyncInterval = config.env === 'development' ? 60_000 : 300_000;
  const traceSyncJob = new TraceSyncJob(litellmClient, aiGatewayRepo, traceSyncInterval);

  /* ──── Eval Benchmark ──── */
  const evalBenchmarkRepo = new EvalBenchmarkRepository(db);
  const evalEvaluatorRepo = new EvalEvaluatorRepository(db);
  // v1.7:eval 真实 Agent 执行(litellm + toolMgmt + toolDefRepo 多轮工具循环)。toolMgmt 已早实例化。
  const evalAgentPort = new EvalAgentInvoker(
    litellmClient,
    toolManagementService,
    new ToolDefinitionRepository(db)
  );
  const evalService = new EvalService(
    evalBenchmarkRepo,
    evalEvaluatorRepo,
    litellmClient,
    evalAgentPort
  );

  /* ──── Employee Memory ──── */
  const employeeMemoryRepo = new EmployeeMemoryRepository(db);
  const mem0Client = new Mem0Client();
  const memoryService = new MemoryService(
    employeeMemoryRepo,
    knowledgeService,
    mem0Client,
    instanceRepo
  );

  // D2:激活 RAG 上下文召回(knowledge + memory + LLM 判断)。knowledgeService null 时只召回 memory 侧。
  agentHarness.setRagProvider(buildRagProvider(knowledgeService, memoryService, agentLlmClient));

  // v1.4:激活组装层(按 Agent 定义自动组装 allowedTools + skillsContext)。
  // instanceRepo/skillRepo 早实例化;AgentDefinitionRepository/ToolDefinitionRepository 此处独立 new(assembly 专用)。
  agentHarness.setAssemblyProvider(
    buildAssemblyProvider(
      instanceRepo,
      new AgentDefinitionRepository(db),
      new ToolDefinitionRepository(db),
      skillRepo
    )
  );

  // v1.6:激活 trace 记录器(dispatchTask 全链路 trace 串联)。aiGatewayRepo 早实例化。
  agentHarness.setTraceRecorder(buildTraceRecorder(aiGatewayRepo));

  /* ──── Scheduled Tasks (定时任务调度) ──── */
  const scheduledTaskRepo = new ScheduledTaskRepository(db);
  const scheduledTaskCron = new CronExpressionCalculator();
  const scheduledTaskLock = new PgAdvisoryLockProvider(pool);
  const oauthStateStore: IOAuthStateStore = new DbOAuthStateRepository(db);
  const instanceHealthRepo = new InstanceHealthRepository(db);
  const systemHandler = new SystemJobHandler();
  registerTraceCleanup(systemHandler, aiGatewayRepo);
  registerEmployeeCleanup(systemHandler, clusterInstanceClient, instanceService);
  registerWeeklyReport(systemHandler, analyticsService);
  registerOAuthStateCleanup(systemHandler, oauthStateStore);
  registerInstanceHealthMonitor(
    systemHandler,
    instanceService,
    instanceHealthRepo,
    containerOrchestratorClient,
    notificationService
  );
  // v1.8:声明/运行调和 controller(*/5 spec-diff reconcile;失败兜底复用上方 rebuild)
  registerInstanceReconciler(systemHandler, instanceService);
  const jobHandlerRegistry = new JobHandlerRegistry();
  const agentInvoker = new LlmAgentInvoker(litellmClient, {});
  jobHandlerRegistry.register(new AgentJobHandler(agentInvoker));
  jobHandlerRegistry.register(systemHandler);
  const schedulerInterval = config.env === 'development' ? 60_000 : 30_000;
  const schedulerService = new SchedulerService(
    scheduledTaskRepo,
    jobHandlerRegistry,
    scheduledTaskCron,
    scheduledTaskLock,
    schedulerInterval,
    300_000,
    (task, errorMessage) => {
      // 死信告警:落 system 租户通知,等运维介入 reset(nextRunAt)
      notificationService
        .createAlert('system', {
          type: 'scheduler_dead_letter',
          severity: 'critical',
          title: `定时任务「${task.name}」进入死信`,
          message: `连续失败已达上限:${errorMessage}`,
          sourceId: task.id,
          sourceName: task.name,
        })
        .catch((err) => {
          // scheduler 已 try/catch 包裹回调,此处仅日志兜底
          logger.warn(
            { taskId: task.id, err: String(err) },
            'bootstrap: scheduler dead-letter alert failed'
          );
        });
    }
  );

  // 启动前幂等 seed 关键调度任务(instance-health-monitor 等)。
  // 不 await:不阻塞 app 启动;失败仅日志,schedulerService.start 仍会跑已存在任务。
  ensureSchedulerTasks(scheduledTaskRepo, BOOTSTRAP_SCHEDULER_TASKS).catch((err) =>
    logger.warn({ err: String(err) }, 'bootstrap: ensureSchedulerTasks failed')
  );

  /* ──── Document → WeKnora 发布同步钩子 ──── */
  if (knowledgeService) {
    documentService.setSyncHook({
      async onPublished(doc) {
        if (!doc.tenantId) return;
        const mapping = await wkMappingRepo.getByHmrTenantId(doc.tenantId);
        const kbId = mapping?.defaultKbId;
        if (!kbId) return;
        const htmlContent = (doc.content as Record<string, unknown>)?.html || '';
        await knowledgeService.syncDocument(doc.tenantId, kbId, {
          id: doc.id,
          title: doc.title,
          content: typeof htmlContent === 'string' ? htmlContent : JSON.stringify(htmlContent),
          type: doc.type,
        });
      },
    });
  }

  /* ──── MatrixBot (条件启用) ──── */
  // MatrixBot 适配器//logger 拆出到 bootstrap/matrix-adapters.ts;
  // domain Instance → MatrixBot InstanceRow 的窄契约投影细节见该文件。
  const matrixBotLogger = createMatrixBotLogger(logger);
  const { matrixInstanceAdapter, matrixDocumentAdapter } = createMatrixBotDeps({
    instanceService,
    documentService,
    auditService,
    knowledgeService,
  });

  const matrixBot = new MatrixBot(
    {
      matrixAccessToken: config.matrix.botAccessToken,
      matrixUserId: config.matrix.botUserId,
      matrixConversationMode: process.env.MATRIX_CONVERSATION_MODE,
    },
    matrixBotLogger,
    matrixInstanceAdapter,
    {
      auditService: {
        log: async (type: string, payload?: Record<string, unknown>) => {
          await auditService.log(type, payload ?? {});
        },
      },
      documentService: matrixDocumentAdapter,
      weKnoraService: knowledgeService
        ? {
            query: async (q: string, tenantId?: string, kbIds?: string[]) => {
              const result = await knowledgeService.query(tenantId || '', q, kbIds);
              return { answer: result.answer, sources: result.sources };
            },
            search: async (kw: string, tenantId?: string, kbIds?: string[]) => {
              return knowledgeService.search(tenantId || '', kw, kbIds);
            },
          }
        : undefined,
    }
  );

  return {
    db,
    authService,
    tenantService,
    auditService,
    skillService,
    instanceService,
    departmentService,
    documentService,
    credentialService,
    leaseService,
    credentialManagementService,
    channelService,
    decisionConsole,
    mcpService,
    tokenUsageService,
    marketplaceService,
    workspaceService,
    agentProfileService,
    agentProfileRepo,
    aiGatewayRepo,
    modelGrantChecker,
    llmKeySyncService,
    operationalRepo,
    openclawRepo,
    marketplaceClient,
    profileServiceClient,
    workspaceBackendClient,
    containerOrchestratorClient,
    clusterInstanceClient,
    litellmClient,
    matrixBot: config.matrix.botAccessToken ? matrixBot : null,
    containerOrchestratorWsBridge: containerOrchestratorClient.isConfigured()
      ? (() => {
          const bridge = new ContainerOrchestratorWsBridge(containerOrchestratorClient);
          bridge.start();
          return bridge;
        })()
      : null,
    weKnoraClient,
    knowledgeService,
    agentCore,
    analyticsService,
    userManagementService,
    systemConfigService,
    configRepo,
    notificationService,
    toolManagementService,
    toolRegistryService,
    pushChannelService,
    sharedAgentService,
    quotaService,
    planService,
    quotaMonitor,
    traceSyncJob,
    evalBenchmarkRepo,
    evalEvaluatorRepo,
    evalService,
    memoryService,
    scheduledTaskRepo,
    schedulerService,
    jobHandlerRegistry,
    scheduledTaskCron,
    messageNormalizer,
    priorityScorer,
    dedupEngine,
    recommendationEngine,
    receiptManager,
    agentAdapterRegistry,
    oauthStateStore,
    billingService,
    gatewayHealth: new GatewayHealth([
      marketplaceClient,
      profileServiceClient,
      workspaceBackendClient,
      containerOrchestratorClient,
      clusterInstanceClient,
      litellmClient,
    ]),
  };
}
