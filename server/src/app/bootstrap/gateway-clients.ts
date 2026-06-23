/**
 * 9 个外部服务 HTTP 客户端的构造。
 *
 * 从 `bootstrap.ts` 拆出,所有 client 都基于 `config.gateway.*` / `config.litellm.*`
 * 构造,带可选鉴权头。是否配置由 config 决定,这里不做条件分支(统一返回实例,
 * 调用方按 client.isConfigured() 自行判断)。
 */
import { config } from '../../config/index.js';
import { MarketplaceClient } from '../../contexts/gateway/clients/marketplace-client.js';
import { ProfileServiceClient } from '../../contexts/gateway/clients/profile-service-client.js';
import { WorkspaceBackendClient } from '../../contexts/gateway/clients/workspace-backend-client.js';
import { ContainerOrchestratorClient } from '../../contexts/gateway/clients/container-orchestrator-client.js';
import { ClusterInstanceClient } from '../../contexts/gateway/clients/cluster-instance-client.js';
import { LiteLLMClient } from '../../contexts/gateway/clients/litellm-client.js';

export interface GatewayClients {
  marketplaceClient: MarketplaceClient;
  profileServiceClient: ProfileServiceClient;
  workspaceBackendClient: WorkspaceBackendClient;
  containerOrchestratorClient: ContainerOrchestratorClient;
  clusterInstanceClient: ClusterInstanceClient;
  litellmClient: LiteLLMClient;
}

export function buildGatewayClients(): GatewayClients {
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

  return {
    marketplaceClient,
    profileServiceClient,
    workspaceBackendClient,
    containerOrchestratorClient,
    clusterInstanceClient,
    litellmClient,
  };
}
