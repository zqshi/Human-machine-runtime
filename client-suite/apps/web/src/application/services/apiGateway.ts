/**
 * Application-layer API gateway.
 *
 * Re-exports infrastructure API adapters so that presentation layer
 * imports from application/ (respecting DDD dependency direction)
 * instead of reaching directly into infrastructure/.
 */
export {
  documentApi,
  uploadApi,
  logsApi,
  employeeApi,
  agentApi,
} from '../../infrastructure/api/hmrApiClient';
export { weKnoraApi } from '../../infrastructure/api/weKnoraClient';
export type { ChatMessage as WeKnoraChatMessage } from '../../infrastructure/api/weKnoraClient';
export {
  marketplaceApi,
  profileApi,
  channelApi,
  workspaceApi,
  mcpApi,
} from '../../infrastructure/api/upstreamApiClient';
export type { SkillItem, AgentItem } from '../../infrastructure/api/upstreamApiClient';
export {
  skillApi,
  toolApi,
  aiGatewayApi,
  adminLogsApi,
  authMgmtApi,
  adminNotificationApi,
  analyticsApi,
} from '../../infrastructure/api/adminApiClient';
export {
  tenantApi,
  platformUserApi,
  platformConfigApi,
  platformMonitoringApi,
} from '../../infrastructure/api/platformApiClient';
