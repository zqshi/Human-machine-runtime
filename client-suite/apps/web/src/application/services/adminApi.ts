/**
 * Admin & Platform API — Application-layer re-export
 *
 * Presentation 层通过本模块间接访问 admin/platform API，
 * 避免跨层直接依赖 infrastructure。
 */
export {
  skillApi,
  toolApi,
  aiGatewayApi,
  adminLogsApi,
  authMgmtApi,
  adminNotificationApi,
  analyticsApi,
  employeeDetailApi,
  instanceApi,
  quotaApi,
  channelApi,
} from '../../infrastructure/api/adminApiClient';

export type {
  QuotaDashboardData,
  QuotaUsageItem,
  AllocationData,
  AllocationRow,
  QuotaAlertRule,
  QuotaAlertEvent,
  TenantDefaultConfig,
  ChannelConfig,
  GrantInstanceDTO,
} from '../../infrastructure/api/adminApiClient';

export type { ToolDefinition } from '../../domain/tool/types';

export {
  tenantApi,
  platformUserApi,
  platformRoleApi,
  platformConfigApi,
  platformMonitoringApi,
  platformAuditApi,
  planApi,
} from '../../infrastructure/api/platformApiClient';

export type { PlanDTO } from '../../infrastructure/api/platformApiClient';

export {
  openclawMonitorApi,
  openclawStatisticsApi,
  openclawConfigApi,
} from '../../infrastructure/api/openclawAdminApiClient';

export {
  employeeApi,
  agentApi,
  authApi,
  appCatalogApi,
} from '../../infrastructure/api/hmrApiClient';
export type {
  Employee,
  EmployeeResourceConfig,
  AgentRuntime,
  EmployeeRemote,
  AppCatalogItem,
} from '../../infrastructure/api/hmrApiClient';

export type {
  OpenclawConfig,
  ConfigSnapshot,
} from '../../infrastructure/api/openclawAdminApiClient';

export type { WorkspaceDTO } from '../../infrastructure/api/openclawWorkspaceApiClient';

export { evalApi } from '../../infrastructure/api/evalApiClient';
export { scheduledTaskApi } from '../../infrastructure/api/scheduledTaskApiClient';
export type {
  ScheduledTask,
  ScheduledTaskRun,
  CronValidation,
  ScheduledTaskInput,
} from '../../infrastructure/api/scheduledTaskApiClient';
export type {
  EvalSuite,
  EvalCase,
  EvalRun,
  EvalResult,
  EvalReplayEntry,
  EvalAlertRule,
  DashboardMetrics,
  EvalReport,
  EvalEvaluator,
  EvalDimension,
  ScoringRubricEntry,
  RuleConfigItem,
  JudgeConfig,
  ToolCallEntry,
} from '../../infrastructure/api/evalApiClient';

export { employeeMemoryApi } from '../../infrastructure/api/employeeMemoryApiClient';
export type {
  MemoryStore,
  MemoryFragment,
  MemoryRule,
  RetrievalConfig,
  MemorySearchHit,
  MemorySearchResult,
} from '../../infrastructure/api/employeeMemoryApiClient';

export { departmentApi } from '../../infrastructure/api/departmentApiClient';
export type { Department } from '../../infrastructure/api/departmentApiClient';
