/**
 * AppContext — 全应用依赖容器接口。
 *
 * 从 `bootstrap.ts` 拆出,便于路由/服务类型导入时不必拉入整个 bootstrap 的实现依赖。
 * 字段顺序与原 bootstrap.ts 中 AppContext 定义保持一致(见 git history)。
 */
import type { Database } from '../../db/client.js';

import type { AuthService } from '../../contexts/identity-access/auth-service.js';
import type { TenantService } from '../../contexts/tenant-management/tenant-service.js';
import type { PlanService } from '../../contexts/tenant-management/plan-service.js';
import type { AuditService } from '../../contexts/audit-observability/audit-service.js';
import type { SkillService } from '../../contexts/shared-assets/skill-service.js';
import type { InstanceService } from '../../contexts/tenant-instance/instance-service.js';
import type { DepartmentService } from '../../contexts/department/department-service.js';
import type { DocumentService } from '../../contexts/document/document-service.js';
import type { CredentialService } from '../../contexts/credential-vault/credential-service.js';
import type { LeaseService } from '../../contexts/credential-vault/lease-service.js';
import type { CredentialManagementService } from '../../contexts/credential-vault/credential-management-service.js';
import type { ChannelService } from '../../contexts/channel/channel-service.js';
import type { DecisionConsole } from '../../contexts/channel/decision-console.js';
import type { McpService } from '../../contexts/mcp-management/mcp-service.js';
import type { TokenUsageService } from '../../contexts/observability/token-usage-service.js';
import type { TraceSyncJob } from '../../contexts/observability/trace-sync-job.js';

import type { MarketplaceClient } from '../../contexts/gateway/clients/marketplace-client.js';
import type { ProfileServiceClient } from '../../contexts/gateway/clients/profile-service-client.js';
import type { WorkspaceBackendClient } from '../../contexts/gateway/clients/workspace-backend-client.js';
import type { ContainerOrchestratorClient } from '../../contexts/gateway/clients/container-orchestrator-client.js';
import type { ContainerOrchestratorWsBridge } from '../../contexts/gateway/clients/container-orchestrator-ws-bridge.js';
import type { ClusterInstanceClient } from '../../contexts/gateway/clients/cluster-instance-client.js';
import type { LiteLLMClient } from '../../contexts/gateway/clients/litellm-client.js';
import type { WeKnoraClient } from '../../contexts/gateway/clients/weknora-client.js';
import type { ModelGrantChecker } from '../../contexts/gateway/model-grant-checker.js';
import type { LlmKeySyncService } from '../../contexts/gateway/llm-key-sync-service.js';
import type { GatewayHealth } from '../../contexts/gateway/gateway-health.js';

import type { MarketplaceService } from '../../contexts/marketplace/marketplace-service.js';
import type { WorkspaceService } from '../../contexts/workspace/workspace-service.js';
import type { AgentProfileService } from '../../contexts/agent-profile/agent-profile-service.js';
import type { KnowledgeService } from '../../contexts/knowledge/knowledge-service.js';
import type { AgentCore } from '../../contexts/agent-core/agent-core.js';
import type { AgentRuntimeAdapterRegistry } from '../../contexts/agent-core/sandbox/adapter-registry.js';
import type { AnalyticsService } from '../../contexts/analytics/analytics-service.js';
import type { UserManagementService } from '../../contexts/identity-access/user-management-service.js';
import type { SystemConfigService } from '../../contexts/system-config/system-config-service.js';
import type { NotificationService } from '../../contexts/notification/notification-service.js';
import type { ToolManagementService } from '../../contexts/tool-management/tool-management-service.js';
import type { ToolRegistryService } from '../../contexts/tool-management/tool-registry-service.js';
import type { ToolApprovalRepository } from '../../db/repositories/tool-approvals-repository.js';
import type { PushChannelService } from '../../contexts/push-channel/push-channel-service.js';
import type { SharedAgentService } from '../../contexts/shared-agent/shared-agent-service.js';
import type { QuotaService } from '../../contexts/quota-management/quota-service.js';
import type { QuotaMonitor } from '../../contexts/quota-management/quota-monitor.js';
import type { EvalService } from '../../contexts/eval-benchmark/eval-service.js';
import type { MemoryService } from '../../contexts/employee-memory/memory-service.js';
import type { SchedulerService } from '../../contexts/scheduler/scheduler-service.js';
import type { JobHandlerRegistry } from '../../contexts/scheduler/job-handler-registry.js';
import type { ICronCalculator } from '../../contexts/scheduler/domain/cron.js';
import type { MessageNormalizer } from '../../contexts/runtime-engine/message-normalizer.js';
import type { PriorityScorer } from '../../contexts/runtime-engine/priority-scorer.js';
import type { DedupEngine } from '../../contexts/runtime-engine/dedup-engine.js';
import type { RecommendationEngine } from '../../contexts/runtime-engine/recommendation-engine.js';
import type { ReceiptManager } from '../../contexts/runtime-engine/receipt-manager.js';
import type { IOAuthStateStore } from '../../contexts/identity-access/oauth-state-store.js';
import type { BillingService } from '../../contexts/billing/billing-service.js';
import type { AgentDefinitionService } from '../../contexts/agent-core/application/agent-definition-service.js';
import type { IPersonaProvider } from '../../contexts/agent-core/domain/persona-provider.js';
import type { StudioService } from '../../contexts/agent-core/application/studio-service.js';
import type { ChatService } from '../../contexts/agent-core/application/chat-service.js';
import type { SignalService } from '../../contexts/cockpit/application/signal-service.js';

import type { MatrixBot } from '../../integrations/matrix/matrix-bot.js';
import type { AiGatewayRepository } from '../../db/repositories/ai-gateway-repository.js';
import type { ConfigRepository } from '../../db/repositories/config-repository.js';
import type { CockpitRepository } from '../../db/repositories/cockpit-repository.js';
import type { RuntimeManifestRepository } from '../../db/repositories/runtime-manifest-repository.js';
import type { BakingService } from '../../contexts/agent-core/application/baking-service.js';
import type { OperationalRepository } from '../../db/repositories/operational-repository.js';
import type { AgentProfileRepository } from '../../db/repositories/agent-profile-repository.js';
import type { EvalBenchmarkRepository } from '../../db/repositories/eval-benchmark-repository.js';
import type { EvalEvaluatorRepository } from '../../db/repositories/eval-evaluator-repository.js';
import type { ScheduledTaskRepository } from '../../db/repositories/scheduled-task-repository.js';

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
  credentialManagementService: CredentialManagementService;
  /** v1.9 T3 PersonaProvider(人设 + guardrails);T15 cockpit chat route 复用作后端 guardrail 兜底 */
  personaProvider: IPersonaProvider;
  /** T13 cockpit Studio 资产聚合 service(替代 studio route STUB) */
  studioService: StudioService;
  /** T57 对话能力核心(persona/guardrail/history/LiteLLM);cockpit chat route + Matrix bot 共用(DRY)。
   *  T59 bootstrap 注入 onUsage 回调(recordUsage+recordEvent),chat 成功即入账。 */
  chatService: ChatService;
  channelService: ChannelService;
  decisionConsole: DecisionConsole;
  mcpService: McpService;
  tokenUsageService: TokenUsageService;
  cockpitRepo: CockpitRepository;
  /** v2.1 EAOS 感知子系统用例（emergent/pattern CRUD + corrections/apply） */
  signalService: SignalService;
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
  toolApprovalRepo: ToolApprovalRepository;
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
  agentDefinitionService: AgentDefinitionService;
  /** v2.0 编译固化层:agent_runtime_manifests 表 repo + BakingService(bake 编排)。C12 后台 route 消费 */
  runtimeManifestRepo: RuntimeManifestRepository;
  bakingService: BakingService;
}
