import { pool, type Database } from '../db/client.js';
import { config } from '../config/index.js';
import { logger } from './logger.js';
import { appEventBus } from '../shared/event-bus.js';
import { encrypt, decrypt } from '../contexts/credential-vault/crypto.js';

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
import type { Instance } from '../contexts/tenant-instance/domain/instance.js';
import { ModelGrantChecker } from '../contexts/gateway/model-grant-checker.js';
import { LlmKeySyncService } from '../contexts/gateway/llm-key-sync-service.js';
import { DocumentService } from '../contexts/document/document-service.js';
import { CredentialService } from '../contexts/credential-vault/credential-service.js';
import { LeaseService } from '../contexts/credential-vault/lease-service.js';
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
import type {
  IInstanceService,
  IDocumentService,
  InstanceRow,
} from '../integrations/matrix/matrix-bot-types.js';

import { ContainerOrchestratorWsBridge } from '../contexts/gateway/clients/container-orchestrator-ws-bridge.js';

import { WeKnoraClient } from '../contexts/gateway/clients/weknora-client.js';
import { WkMappingRepository } from '../db/repositories/weknora-mapping-repository.js';
import { KnowledgeBaseRepository } from '../db/repositories/knowledge-base-repository.js';
import { KnowledgeEntryRepository } from '../db/repositories/knowledge-entry-repository.js';
import { KnowledgeService } from '../contexts/knowledge/knowledge-service.js';

import { MarketplaceClient } from '../contexts/gateway/clients/marketplace-client.js';
import { ProfileServiceClient } from '../contexts/gateway/clients/profile-service-client.js';
import { WorkspaceBackendClient } from '../contexts/gateway/clients/workspace-backend-client.js';
import { ContainerOrchestratorClient } from '../contexts/gateway/clients/container-orchestrator-client.js';
import { ClusterInstanceClient } from '../contexts/gateway/clients/cluster-instance-client.js';
import { LiteLLMClient } from '../contexts/gateway/clients/litellm-client.js';

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
import { DbOAuthStateRepository } from '../db/repositories/oauth-state-repository.js';
import type { IOAuthStateStore } from '../contexts/identity-access/oauth-state-store.js';
import { registerOAuthStateCleanup } from '../contexts/scheduler/handlers/oauth-state-cleanup.js';
import { BillingRepository } from '../db/repositories/billing-repository.js';
import { BillingService } from '../contexts/billing/billing-service.js';
import { estimateCostUsd } from '../contexts/agent-core/domain/pricing.js';
import type { ICronCalculator } from '../contexts/scheduler/domain/cron.js';

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

export interface AppContext {
  db: Database;
  authService: AuthService;
  tenantService: TenantService;
  auditService: AuditService;
  skillService: SkillService;
  instanceService: InstanceService;
  departmentService: DepartmentService;
  documentService: DocumentService;
  credentialService: CredentialService;
  leaseService: LeaseService;
  channelService: ChannelService;
  decisionConsole: DecisionConsole;
  mcpService: McpService;
  tokenUsageService: TokenUsageService;
  openclawRepo: OpenclawRepository;
  marketplaceService: MarketplaceService;
  workspaceService: WorkspaceService;
  agentProfileService: AgentProfileService;
  agentProfileRepo: AgentProfileRepository;
  aiGatewayRepo: AiGatewayRepository;
  modelGrantChecker: ModelGrantChecker;
  llmKeySyncService: LlmKeySyncService;
  operationalRepo: OperationalRepository;
  marketplaceClient: MarketplaceClient;
  profileServiceClient: ProfileServiceClient;
  workspaceBackendClient: WorkspaceBackendClient;
  containerOrchestratorClient: ContainerOrchestratorClient;
  clusterInstanceClient: ClusterInstanceClient;
  litellmClient: LiteLLMClient;
  matrixBot: MatrixBot | null;
  containerOrchestratorWsBridge: ContainerOrchestratorWsBridge | null;
  weKnoraClient: WeKnoraClient | null;
  knowledgeService: KnowledgeService | null;
  agentCore: AgentCore;
  analyticsService: AnalyticsService;
  userManagementService: UserManagementService;
  systemConfigService: SystemConfigService;
  configRepo: ConfigRepository;
  notificationService: NotificationService;
  toolManagementService: ToolManagementService;
  toolRegistryService: ToolRegistryService;
  pushChannelService: PushChannelService;
  sharedAgentService: SharedAgentService;
  gatewayHealth: GatewayHealth;
  quotaService: QuotaService;
  planService: PlanService;
  quotaMonitor: QuotaMonitor;
  traceSyncJob: TraceSyncJob;
  evalBenchmarkRepo: EvalBenchmarkRepository;
  evalEvaluatorRepo: EvalEvaluatorRepository;
  evalService: EvalService;
  memoryService: MemoryService;
  scheduledTaskRepo: ScheduledTaskRepository;
  schedulerService: SchedulerService;
  jobHandlerRegistry: JobHandlerRegistry;
  scheduledTaskCron: ICronCalculator;
  messageNormalizer: MessageNormalizer;
  priorityScorer: PriorityScorer;
  dedupEngine: DedupEngine;
  recommendationEngine: RecommendationEngine;
  receiptManager: ReceiptManager;
  /** @deprecated 用 ctx.agentCore.sandbox。下个版本删除。 */
  agentAdapterRegistry: AgentRuntimeAdapterRegistry;
  oauthStateStore: IOAuthStateStore;
  billingService: BillingService;
}

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

  const credentialService = new CredentialService(config.credential.encryptionKey);
  const leaseService = new LeaseService(config.credential.leaseDefaultTtlSec);

  const marketplaceClient = new MarketplaceClient('marketplace', config.gateway.marketplaceUrl, {
    headers: config.gateway.marketplaceApiKey
      ? { Authorization: `Bearer ${config.gateway.marketplaceApiKey}` }
      : undefined,
  });
  const profileServiceClient = new ProfileServiceClient(
    'profile-service',
    config.gateway.profileServiceUrl,
    {
      headers: config.gateway.profileServiceApiToken
        ? { Authorization: `Bearer ${config.gateway.profileServiceApiToken}` }
        : undefined,
    }
  );
  const workspaceBackendClient = new WorkspaceBackendClient(
    'workspace-backend',
    config.gateway.workspaceBackendUrl,
    {
      headers: config.gateway.workspaceBackendAppId
        ? { 'X-App-Id': config.gateway.workspaceBackendAppId }
        : undefined,
    }
  );
  if (config.gateway.workspaceBackendSupabaseUrl && config.gateway.workspaceBackendSupabaseEmail) {
    workspaceBackendClient.setSupabaseAuth({
      url: config.gateway.workspaceBackendSupabaseUrl,
      anonKey: config.gateway.workspaceBackendSupabaseAnonKey,
      email: config.gateway.workspaceBackendSupabaseEmail,
      password: config.gateway.workspaceBackendSupabasePassword,
    });
  }
  const containerOrchestratorClient = new ContainerOrchestratorClient(
    'container-orchestrator',
    config.gateway.containerOrchestratorUrl,
    {
      headers: config.gateway.containerOrchestratorApiToken
        ? { Authorization: `Bearer ${config.gateway.containerOrchestratorApiToken}` }
        : undefined,
    }
  );
  const litellmClient = new LiteLLMClient('litellm', config.litellm.baseUrl, {
    headers: config.litellm.apiKey
      ? { Authorization: `Bearer ${config.litellm.apiKey}` }
      : undefined,
  });
  const clusterInstanceClient = new ClusterInstanceClient(
    'cluster-instance',
    config.gateway.clusterInstanceUrl,
    {
      headers: config.gateway.clusterInstanceAuthToken
        ? { Authorization: `Bearer ${config.gateway.clusterInstanceAuthToken}` }
        : undefined,
    }
  );

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
  const evalService = new EvalService(evalBenchmarkRepo, evalEvaluatorRepo, litellmClient);

  /* ──── Employee Memory ──── */
  const employeeMemoryRepo = new EmployeeMemoryRepository(db);
  const mem0Client = new Mem0Client();
  const memoryService = new MemoryService(
    employeeMemoryRepo,
    knowledgeService,
    mem0Client,
    instanceRepo
  );

  /* ──── Scheduled Tasks (定时任务调度) ──── */
  const scheduledTaskRepo = new ScheduledTaskRepository(db);
  const scheduledTaskCron = new CronExpressionCalculator();
  const scheduledTaskLock = new PgAdvisoryLockProvider(pool);
  const oauthStateStore: IOAuthStateStore = new DbOAuthStateRepository(db);
  const systemHandler = new SystemJobHandler();
  registerTraceCleanup(systemHandler, aiGatewayRepo);
  registerEmployeeCleanup(systemHandler, clusterInstanceClient, instanceService);
  registerWeeklyReport(systemHandler, analyticsService);
  registerOAuthStateCleanup(systemHandler, oauthStateStore);
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
    schedulerInterval
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
  const matrixBotLogger = {
    info: (msg: string, meta?: Record<string, unknown>) =>
      logger.info(meta ?? {}, `[MatrixBot] ${msg}`),
    warn: (msg: string, meta?: Record<string, unknown>) =>
      logger.warn(meta ?? {}, `[MatrixBot] ${msg}`),
    error: (msg: string, meta?: Record<string, unknown>) =>
      logger.error(meta ?? {}, `[MatrixBot] ${msg}`),
  };

  /*
   * MatrixBot 期望的 IInstanceService / IDocumentService 是其自有窄契约
   *（InstanceRow），与 domain InstanceService 的返回类型 Instance 存在结构性差异：
   *   - Instance.matrixRoomId 为 `string | null`，InstanceRow.matrixRoomId 为 `string | undefined`
   *   - Instance.runtime 为 `Record<string, unknown>`，InstanceRow.runtime 为 `{ endpoint?: string }`
   * 此处用显式适配器把 domain service 适配为 MatrixBot 所需接口，消除原先 `as never`
   * 的类型逃逸。运行时行为保持不变（原 `as never` 传入的也是同一 InstanceService 实例，
   * MatrixBot 实际只读取 id / name / state / matrixRoomId / runtime.endpoint 字段）：
   *   - list / get / start / stop → 委托 InstanceService，经 toInstanceRow 投影为 InstanceRow
   *   - createFromMatrix / buildMatrixCard → 维持原 InstanceService 无对应实现的行为（抛错，
   *     `!create_agent` / 自然语言创建路径本就会因签名错位失败）
   *   - getProvisioningJob → 维持 undefined（commands.ts 已有守卫）
   *   - document create / get → 委托 DocumentService，Document 是返回窄类型的超集
   */
  const toInstanceRow = (inst: Instance): InstanceRow => ({
    id: inst.id,
    name: inst.name,
    state: inst.state,
    matrixRoomId: inst.matrixRoomId ?? undefined,
    runtime: {
      endpoint: typeof inst.runtime?.endpoint === 'string' ? inst.runtime.endpoint : undefined,
    },
  });
  const matrixInstanceAdapter: IInstanceService = {
    list: async (tenantId?: string, resourceSource?: string) =>
      (await instanceService.list(tenantId, resourceSource)).map(toInstanceRow),
    get: async (id: string) => toInstanceRow(await instanceService.get(id)),
    start: async (id: string) => toInstanceRow(await instanceService.start(id)),
    stop: async (id: string) => toInstanceRow(await instanceService.stop(id)),
    async createFromMatrix() {
      throw new Error(
        'createFromMatrix via MatrixBot is not wired to InstanceService; use the control-plane HTTP endpoint instead'
      );
    },
    buildMatrixCard() {
      throw new Error(
        'buildMatrixCard via MatrixBot is not wired to InstanceService; use the control-plane HTTP endpoint instead'
      );
    },
  };

  const matrixDocumentAdapter: IDocumentService = {
    create: async (params) => {
      const doc = await documentService.create({
        title: params.title,
        roomId: params.roomId,
        type: params.type,
        createdBy: params.createdBy,
        content: params.content,
      });
      return { id: doc.id, title: doc.title };
    },
    get: async (id: string) => {
      const doc = await documentService.get(id);
      return {
        id: doc.id,
        title: doc.title,
        type: doc.type,
        content: doc.content,
      };
    },
  };

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
