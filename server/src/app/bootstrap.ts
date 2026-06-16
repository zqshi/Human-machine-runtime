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
import { ClawFarmProvisioner } from '../contexts/tenant-instance/provisioners/claw-farm-provisioner.js';
import { CompositeProvisioner } from '../contexts/tenant-instance/provisioners/composite-provisioner.js';
import { MatrixBot } from '../integrations/matrix/matrix-bot.js';

import { ClawFarmWsBridge } from '../contexts/gateway/clients/claw-farm-ws-bridge.js';

import { WeKnoraClient } from '../contexts/gateway/clients/weknora-client.js';
import { WkMappingRepository } from '../db/repositories/weknora-mapping-repository.js';
import { KnowledgeBaseRepository } from '../db/repositories/knowledge-base-repository.js';
import { KnowledgeEntryRepository } from '../db/repositories/knowledge-entry-repository.js';
import { KnowledgeService } from '../contexts/knowledge/knowledge-service.js';

import { ClawHubClient } from '../contexts/gateway/clients/clawhub-client.js';
import { PortalClient } from '../contexts/gateway/clients/portal-client.js';
import { XspaceClient } from '../contexts/gateway/clients/xspace-client.js';
import { ClawFarmClient } from '../contexts/gateway/clients/claw-farm-client.js';
import { ClawManagerClient } from '../contexts/gateway/clients/claw-manager-client.js';
import { LiteLLMClient } from '../contexts/gateway/clients/litellm-client.js';
import { PlatformBeClient } from '../contexts/gateway/clients/platform-be-client.js';

import { MarketplaceService } from '../contexts/marketplace/marketplace-service.js';
import { WorkspaceService } from '../contexts/workspace/workspace-service.js';
import { AgentProfileService } from '../contexts/agent-profile/agent-profile-service.js';
import { OpenclawRepository } from '../db/repositories/openclaw-repository.js';
import { OperationalRepository } from '../db/repositories/operational-repository.js';
import { WorkspaceRepository } from '../db/repositories/workspace-repository.js';
import { AgentProfileRepository } from '../db/repositories/agent-profile-repository.js';
import { TokenUsageRepository } from '../db/repositories/token-usage-repository.js';
import { AgentRuntimeService } from '../contexts/agent-core/agent-runtime-service.js';
import { AnalyticsService } from '../contexts/analytics/analytics-service.js';
import { UserManagementService } from '../contexts/identity-access/user-management-service.js';
import { SystemConfigService } from '../contexts/system-config/system-config-service.js';
import { NotificationService } from '../contexts/notification/notification-service.js';
import { ToolManagementService } from '../contexts/tool-management/tool-management-service.js';
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
import { SystemJobHandler, registerTraceCleanup } from '../contexts/scheduler/handlers/system-handler.js';
import { AgentJobHandler } from '../contexts/scheduler/handlers/agent-handler.js';
import { LlmAgentInvoker } from '../contexts/scheduler/handlers/llm-agent-invoker.js';
import { registerEmployeeCleanup } from '../contexts/scheduler/handlers/employee-cleanup.js';
import { registerWeeklyReport } from '../contexts/scheduler/handlers/weekly-report.js';
import type { ICronCalculator } from '../contexts/scheduler/domain/cron.js';

import { MessageNormalizer } from '../contexts/runtime-engine/message-normalizer.js';
import { PriorityScorer } from '../contexts/runtime-engine/priority-scorer.js';
import { DedupEngine } from '../contexts/runtime-engine/dedup-engine.js';
import { RecommendationEngine } from '../contexts/runtime-engine/recommendation-engine.js';
import { ReceiptManager } from '../contexts/runtime-engine/receipt-manager.js';
import { AgentRuntimeAdapterRegistry } from '../contexts/agent-core/domain/agent-runtime-adapter.js';
import { OpenClawAdapter } from '../contexts/agent-core/adapters/openclaw-adapter.js';

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
  clawHubClient: ClawHubClient;
  portalClient: PortalClient;
  xspaceClient: XspaceClient;
  clawFarmClient: ClawFarmClient;
  clawManagerClient: ClawManagerClient;
  litellmClient: LiteLLMClient;
  platformBeClient: PlatformBeClient;
  matrixBot: MatrixBot | null;
  clawFarmWsBridge: ClawFarmWsBridge | null;
  weKnoraClient: WeKnoraClient | null;
  knowledgeService: KnowledgeService | null;
  agentRuntimeService: AgentRuntimeService;
  analyticsService: AnalyticsService;
  userManagementService: UserManagementService;
  systemConfigService: SystemConfigService;
  notificationService: NotificationService;
  toolManagementService: ToolManagementService;
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
  agentAdapterRegistry: AgentRuntimeAdapterRegistry;
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
  clawFarmClient: ClawFarmClient,
  pipeline?: InboundPipeline
): ChannelService {
  const channelService = new ChannelService();
  if (pipeline) channelService.setInboundPipeline(pipeline);
  channelService.registerAdapter(new MatrixChannelAdapter());
  channelService.registerAdapter(new WpsChannelAdapter(clawFarmClient));
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

  const clawHubClient = new ClawHubClient('clawhub', config.gateway.clawhubUrl, {
    headers: config.gateway.clawhubApiKey
      ? { Authorization: `Bearer ${config.gateway.clawhubApiKey}` }
      : undefined,
  });
  const portalClient = new PortalClient('portal', config.gateway.portalUrl, {
    headers: config.gateway.portalApiToken
      ? { Authorization: `Bearer ${config.gateway.portalApiToken}` }
      : undefined,
  });
  const xspaceClient = new XspaceClient('xspace', config.gateway.xspaceUrl, {
    headers: config.gateway.xspaceAppId ? { 'X-App-Id': config.gateway.xspaceAppId } : undefined,
  });
  if (config.gateway.xspaceSupabaseUrl && config.gateway.xspaceSupabaseEmail) {
    xspaceClient.setSupabaseAuth({
      url: config.gateway.xspaceSupabaseUrl,
      anonKey: config.gateway.xspaceSupabaseAnonKey,
      email: config.gateway.xspaceSupabaseEmail,
      password: config.gateway.xspaceSupabasePassword,
    });
  }
  const clawFarmClient = new ClawFarmClient('claw-farm', config.gateway.clawFarmUrl, {
    headers: config.gateway.clawFarmApiToken
      ? { Authorization: `Bearer ${config.gateway.clawFarmApiToken}` }
      : undefined,
  });
  const litellmClient = new LiteLLMClient('litellm', config.litellm.baseUrl, {
    headers: config.litellm.apiKey
      ? { Authorization: `Bearer ${config.litellm.apiKey}` }
      : undefined,
  });
  const platformBeClient = new PlatformBeClient('platform-be', config.gateway.platformBeUrl);
  const clawManagerClient = new ClawManagerClient('claw-manager', config.gateway.clawManagerUrl, {
    headers: config.gateway.clawManagerAuthToken
      ? { Authorization: `Bearer ${config.gateway.clawManagerAuthToken}` }
      : undefined,
  });

  /* ──── Provisioner: local + claw-farm composite ──── */
  const localProvisioner = new LocalProvisioner();
  const provisioners = [localProvisioner];
  if (clawFarmClient.isConfigured()) {
    provisioners.push(new ClawFarmProvisioner(clawFarmClient) as never);
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
  const recommendationEngine = new RecommendationEngine();

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
    }
  });

  const channelService = buildChannelService(clawFarmClient, inboundPipeline);
  const receiptManager = new ReceiptManager(channelService);

  /* ──── AgentRuntimeAdapter Registry ──── */
  const agentAdapterRegistry = new AgentRuntimeAdapterRegistry();
  const openClawAdapter = new OpenClawAdapter(clawManagerClient);
  agentAdapterRegistry.register(openClawAdapter);

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
  const mcpService = new McpService(clawHubClient);
  const tokenUsageService = new TokenUsageService(portalClient, litellmClient, tokenUsageRepo);

  const marketplaceAudit = {
    log(type: string, payload: Record<string, unknown>) {
      auditService.log(type, payload);
    },
  };
  const marketplaceService = new MarketplaceService(clawHubClient, marketplaceAudit);
  const workspaceRepo = new WorkspaceRepository(db);
  const workspaceService = new WorkspaceService(
    workspaceRepo,
    xspaceClient,
    clawHubClient,
    clawManagerClient
  );
  const agentProfileService = new AgentProfileService(portalClient);

  const agentRuntimeService = new AgentRuntimeService(null, db, {
    simulatorEnabled: config.agent.simulatorEnabled,
  });

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
  const pushChannelService = new PushChannelService(operationalRepo);
  const sharedAgentService = new SharedAgentService(
    instanceService,
    operationalRepo,
    clawHubClient
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
  const systemHandler = new SystemJobHandler();
  registerTraceCleanup(systemHandler, aiGatewayRepo);
  registerEmployeeCleanup(systemHandler, clawManagerClient, instanceService);
  registerWeeklyReport(systemHandler, analyticsService);
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
  const matrixBot = new MatrixBot(
    {
      matrixAccessToken: config.matrix.botAccessToken,
      matrixUserId: config.matrix.botUserId,
      matrixConversationMode: process.env.MATRIX_CONVERSATION_MODE,
    },
    matrixBotLogger,
    instanceService as never,
    {
      auditService: {
        log: async (type: string, payload?: Record<string, unknown>) => {
          await auditService.log(type, payload ?? {});
        },
      },
      documentService: documentService as never,
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
    clawHubClient,
    portalClient,
    xspaceClient,
    clawFarmClient,
    clawManagerClient,
    litellmClient,
    platformBeClient,
    matrixBot: config.matrix.botAccessToken ? matrixBot : null,
    clawFarmWsBridge: clawFarmClient.isConfigured()
      ? (() => {
          const bridge = new ClawFarmWsBridge(clawFarmClient);
          bridge.start();
          return bridge;
        })()
      : null,
    weKnoraClient,
    knowledgeService,
    agentRuntimeService,
    analyticsService,
    userManagementService,
    systemConfigService,
    notificationService,
    toolManagementService,
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
    gatewayHealth: new GatewayHealth([
      clawHubClient,
      portalClient,
      xspaceClient,
      clawFarmClient,
      clawManagerClient,
      litellmClient,
      platformBeClient,
    ]),
  };
}
