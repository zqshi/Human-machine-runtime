import { Hono } from 'hono';
import type { AppContext } from '../app/bootstrap.js';
import { createHealthRoutes } from './health.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { auditTrailMiddleware } from '../middleware/audit-trail.js';
import { createAuthRoutes } from './platform/auth.js';
import { createTenantRoutes } from './platform/tenants.js';
import { createAuditRoutes } from './platform/audits.js';
import { createPlatformUserRoutes } from './platform/users.js';
import { createPlatformConfigRoutes } from './platform/config.js';
import { createPlatformMonitoringRoutes } from './platform/monitoring.js';
import { createPlatformRoleRoutes } from './platform/roles.js';
import { createPlanRoutes } from './platform/plans.js';
import { createBillingRoutes } from './platform/billing.js';
import { createControlAgentDefinitionRoutes } from './control/agent-definitions.js';
import { createInstanceRoutes } from './control/instances.js';
import { createDepartmentRoutes } from './control/departments.js';
import { createSkillRoutes } from './control/skills.js';
import { createDocumentRoutes } from './control/documents.js';
import { createCategoryRoutes } from './control/categories.js';
import { createKnowledgeAuditRoutes } from './control/knowledge-audits.js';
import { createKnowledgeRoutes } from './control/knowledge.js';
import { createStorageRoutes } from './control/storage.js';
import { createUploadRoutes } from './control/uploads.js';
import { createControlMarketplaceRoutes } from './control/marketplace.js';
import { createQuotaRoutes } from './control/quotas.js';
import { createAppCatalogRoutes } from './control/app-catalog.js';
import { AppCatalogRepository } from '../db/repositories/app-catalog-repository.js';
import { createAdminInstanceRoutes } from './admin/instances.js';
import { createAdminEmployeeRoutes } from './admin/employees.js';
import { createAdminSkillRoutes } from './admin/skills.js';
import { createAdminToolRoutes } from './admin/tools.js';
import { createAdminAiGatewayRoutes } from './admin/ai-gateway.js';
import { createAdminLogRoutes } from './admin/logs.js';
import { createAdminAuthMgmtRoutes } from './admin/auth-mgmt.js';
import { createAdminNotificationRoutes } from './admin/notifications.js';
import { createAdminPushChannelRoutes } from './admin/push-channels.js';
import { createAdminAnalyticsRoutes } from './admin/analytics.js';
import { createAdminSharedAgentRoutes } from './admin/shared-agents.js';
import { createAdminRuntimeRoutes } from './admin/runtime.js';
import { createAdminCockpitRoutes } from './admin/cockpit.js';
import { createAdminMcpRoutes } from './admin/mcp-management.js';
import { createAdminDashboardRoutes } from './admin/dashboard.js';
import { createAdminAssistantRoutes } from './admin/ai-assistant.js';
import { createAdminEvalRoutes } from './admin/eval-benchmark.js';
import { createAdminScheduledTaskRoutes } from './admin/scheduled-tasks.js';
import { createAdminMemoryRoutes } from './admin/employee-memory.js';
import { createAdminCredentialRoutes } from './admin/credentials.js';
import { createAdminAgentDefinitionRoutes } from './admin/agent-definitions.js';
import { createAdminToolApprovalRoutes } from './admin/tool-approvals.js';
import { createAdminRuntimeTemplateRoutes } from './admin/runtime-templates.js';
import { createAdminFeatureFlagRoutes } from './admin/feature-flags.js';
import { createCockpitTaskRoutes } from './cockpit/tasks.js';
import { createCockpitDecisionRoutes } from './cockpit/decisions.js';
import { createCockpitSignalRoutes } from './cockpit/signals.js';
import { createCockpitObjectiveRoutes } from './cockpit/objectives.js';
import { createCockpitCollaborationRoutes } from './cockpit/collaboration.js';
import { createCockpitBootstrapRoutes } from './cockpit/bootstrap.js';
import { createCockpitChannelRoutes } from './cockpit/channels.js';
import { createCockpitWorkspaceRoutes } from './cockpit/workspace.js';
import { createCockpitOrchestrationRoutes } from './cockpit/orchestration.js';
import { createCockpitEvaluationRoutes } from './cockpit/evaluation.js';
import { createStudioRoutes } from './cockpit/studio.js';
import { createCockpitChatRoutes } from './cockpit/chat.js';
import { createMarketplaceProxyRoutes } from '../contexts/gateway/routes/marketplace-proxy.js';
import { createProfileProxyRoutes } from '../contexts/gateway/routes/profile-proxy.js';
import { createWorkspaceProxyRoutes } from '../contexts/gateway/routes/workspace-proxy.js';
import { createChannelProxyRoutes } from '../contexts/gateway/routes/channel-proxy.js';
import { createMcpProxyRoutes } from '../contexts/gateway/routes/mcp-proxy.js';
import { createMcpToolServerRoutes } from './mcp-endpoint/tool-server.js';
import { createInternalToolExecutorRoutes } from './internal/tool-executor.js';
import { createInternalAuthMiddleware } from '../middleware/internal-auth.js';
import { config } from '../config/index.js';

export function registerRoutes(app: Hono, ctx: AppContext) {
  app.use('*', async (c, next) => {
    (c as unknown as { set(k: string, v: unknown): void }).set('authService', ctx.authService);
    await next();
  });

  app.route('/health', createHealthRoutes(ctx));

  /* ──── Internal (worker↔server RPC,T18b-A;共享密钥认证,非 JWT) ──── */
  const internal = new Hono();
  internal.use('*', createInternalAuthMiddleware(config.claude.internalToolSecret));
  internal.route(
    '/',
    createInternalToolExecutorRoutes(ctx.systemConfigService, ctx.toolRegistryService)
  );
  app.route('/api/internal', internal);

  app.route('/api/auth', createAuthRoutes(ctx.authService, ctx.oauthStateStore));

  /* ──── Platform (L1 运管) ──── */

  const secured = new Hono();
  secured.use('*', authMiddleware);
  secured.use('*', requireRole('platform_admin'));
  secured.route('/tenants', createTenantRoutes(ctx.tenantService));
  secured.route('/audits', createAuditRoutes(ctx.auditService));
  secured.route('/users', createPlatformUserRoutes(ctx.userManagementService));
  secured.route('/config', createPlatformConfigRoutes(ctx.systemConfigService));
  secured.route(
    '/monitoring',
    createPlatformMonitoringRoutes(ctx.instanceService, ctx.tenantService, ctx.analyticsService)
  );
  secured.route('/roles', createPlatformRoleRoutes(ctx.userManagementService));
  secured.route('/plans', createPlanRoutes(ctx.planService));
  secured.route('/billing', createBillingRoutes(ctx.billingService));
  app.route('/api/platform', secured);

  /* ──── Admin (L2 管理控制面) ──── */

  const admin = new Hono();
  admin.use('*', authMiddleware);
  admin.use('*', requireRole('platform_admin'));
  admin.use('*', auditTrailMiddleware(ctx.auditService));
  admin.route(
    '/instances',
    createAdminInstanceRoutes(
      ctx.instanceService,
      ctx.containerOrchestratorClient,
      ctx.clusterInstanceClient
    )
  );
  admin.route(
    '/employees',
    createAdminEmployeeRoutes(
      ctx.instanceService,
      ctx.agentProfileRepo,
      ctx.agentProfileService,
      ctx.clusterInstanceClient
    )
  );
  admin.route(
    '/skills',
    createAdminSkillRoutes(
      ctx.skillService,
      ctx.instanceService,
      ctx.operationalRepo,
      ctx.marketplaceClient
    )
  );
  admin.route('/tools', createAdminToolRoutes(ctx.toolManagementService));
  admin.route(
    '/ai-gateway',
    createAdminAiGatewayRoutes(
      ctx.aiGatewayRepo,
      ctx.operationalRepo,
      ctx.litellmClient,
      ctx.instanceService,
      ctx.llmKeySyncService,
      ctx.configRepo
    )
  );
  admin.route('/logs', createAdminLogRoutes(ctx.auditService));
  admin.route('/auth', createAdminAuthMgmtRoutes(ctx.userManagementService));
  admin.route('/notifications', createAdminNotificationRoutes(ctx.notificationService));
  admin.route('/channels', createAdminPushChannelRoutes(ctx.pushChannelService));
  admin.route('/push-channels', createAdminPushChannelRoutes(ctx.pushChannelService));
  admin.route(
    '/analytics',
    createAdminAnalyticsRoutes(
      ctx.analyticsService,
      ctx.litellmClient,
      ctx.marketplaceClient,
      ctx.containerOrchestratorClient,
      ctx.workspaceBackendClient,
      ctx.profileServiceClient
    )
  );
  admin.route('/agents/shared', createAdminSharedAgentRoutes(ctx.sharedAgentService));
  admin.route('/runtime', createAdminRuntimeRoutes(ctx.systemConfigService));
  admin.route('/cockpit', createAdminCockpitRoutes(ctx.analyticsService));
  admin.route('/mcp', createAdminMcpRoutes(ctx.mcpService));
  admin.route(
    '/dashboard',
    createAdminDashboardRoutes(
      ctx.tokenUsageService,
      ctx.aiGatewayRepo,
      ctx.instanceService,
      ctx.skillService,
      ctx.litellmClient,
      ctx.marketplaceClient,
      ctx.clusterInstanceClient
    )
  );
  admin.route(
    '/assistant',
    createAdminAssistantRoutes(
      ctx.litellmClient,
      ctx.analyticsService,
      ctx.clusterInstanceClient,
      ctx.aiGatewayRepo,
      ctx.skillService,
      ctx.auditService
    )
  );
  admin.route(
    '/eval',
    createAdminEvalRoutes(ctx.evalBenchmarkRepo, ctx.evalService, ctx.evalEvaluatorRepo)
  );
  admin.route(
    '/scheduled-tasks',
    createAdminScheduledTaskRoutes(
      ctx.scheduledTaskRepo,
      ctx.schedulerService,
      ctx.scheduledTaskCron
    )
  );
  admin.route('/employee-memory', createAdminMemoryRoutes(ctx.memoryService));
  admin.route('/credentials', createAdminCredentialRoutes(ctx.credentialManagementService));
  admin.route('/agent-definitions', createAdminAgentDefinitionRoutes(ctx.agentDefinitionService));
  admin.route(
    '/tool-approvals',
    createAdminToolApprovalRoutes(ctx.toolApprovalRepo, ctx.toolManagementService, ctx.auditService)
  );
  admin.route('/runtime-templates', createAdminRuntimeTemplateRoutes());
  admin.route('/feature-flags', createAdminFeatureFlagRoutes(ctx.systemConfigService));
  app.route('/api/admin', admin);

  /* ──── Control (L2 管理控制面) ──── */

  const control = new Hono();
  control.use('*', authMiddleware);
  control.use('*', requireRole('platform_admin', 'tenant_admin'));
  control.route('/instances', createInstanceRoutes(ctx.instanceService, ctx.clusterInstanceClient));
  control.route('/agent-definitions', createControlAgentDefinitionRoutes(ctx.marketplaceService));
  control.route('/departments', createDepartmentRoutes(ctx.departmentService));
  control.route('/skills', createSkillRoutes(ctx.skillService));
  control.route('/documents', createDocumentRoutes(ctx.documentService));
  control.route('/categories', createCategoryRoutes());
  control.route('/knowledge-audits', createKnowledgeAuditRoutes(ctx.documentService));
  if (ctx.knowledgeService) {
    control.route('/knowledge', createKnowledgeRoutes(ctx.knowledgeService));
  }
  control.route('/storage', createStorageRoutes());
  control.route('/uploads', createUploadRoutes());
  control.route('/marketplace', createControlMarketplaceRoutes(ctx.marketplaceService));
  control.route('/audits', createAuditRoutes(ctx.auditService));
  control.route('/quotas', createQuotaRoutes(ctx.quotaService, ctx.tenantService));
  control.route('/app-catalog', createAppCatalogRoutes(new AppCatalogRepository(ctx.db)));
  app.route('/api/control', control);

  /* ──── Cockpit (用户端决策中心) ──── */

  const cockpit = new Hono();
  cockpit.use('*', authMiddleware);
  const taskRoutes = createCockpitTaskRoutes(ctx.cockpitRepo);
  cockpit.route('/', taskRoutes);
  cockpit.route('/', createCockpitDecisionRoutes(ctx.cockpitRepo));
  cockpit.route('/', createCockpitSignalRoutes(ctx.cockpitRepo));
  cockpit.route('/objectives', createCockpitObjectiveRoutes(ctx.cockpitRepo));
  cockpit.route('/', createCockpitCollaborationRoutes(ctx.cockpitRepo));
  cockpit.route('/', createCockpitBootstrapRoutes(ctx.cockpitRepo, ctx.agentCore));
  cockpit.route('/', createCockpitChannelRoutes(ctx.decisionConsole, ctx.channelService));
  cockpit.route('/', createCockpitWorkspaceRoutes(ctx.workspaceService));
  cockpit.route('/', createCockpitOrchestrationRoutes(ctx.cockpitRepo));
  cockpit.route('/', createCockpitEvaluationRoutes(ctx.cockpitRepo));
  cockpit.route('/studio', createStudioRoutes(ctx.studioService));
  cockpit.route('/', createCockpitChatRoutes(ctx.chatService));
  app.route('/api/cockpit', cockpit);

  /* ──── Proxy (Gateway → upstream services) ──── */

  const proxy = new Hono();
  proxy.use('*', authMiddleware);
  proxy.route('/marketplace', createMarketplaceProxyRoutes(ctx.marketplaceClient));
  proxy.route('/profile', createProfileProxyRoutes(ctx.profileServiceClient));
  proxy.route('/workspace', createWorkspaceProxyRoutes(ctx.workspaceBackendClient));
  proxy.route(
    '/channel',
    createChannelProxyRoutes(ctx.containerOrchestratorClient, ctx.channelService)
  );
  proxy.route('/mcp', createMcpProxyRoutes(ctx.mcpService));
  app.route('/api/proxy', proxy);

  /* ──── MCP Tool Server (Agent Runtime 调用) ──── */

  const mcpServer = new Hono();
  mcpServer.use('*', authMiddleware);
  mcpServer.route('/', createMcpToolServerRoutes(ctx.toolManagementService));
  app.route('/api/mcp', mcpServer);
}
