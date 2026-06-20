import type {
  Workspace,
  WorkspaceApp,
  WorkspaceConversation,
  WorkspaceType,
} from './domain/workspace.js';
import { createWorkspace } from './domain/workspace.js';
import type { WorkspaceBackendClient } from '../gateway/clients/workspace-backend-client.js';
import type { MarketplaceClient } from '../gateway/clients/marketplace-client.js';
import type { ClusterInstanceClient } from '../gateway/clients/cluster-instance-client.js';

export interface IWorkspaceRepository {
  findByOwner(ownerId: string): Promise<Workspace[]>;
  findById(id: string): Promise<Workspace | null>;
  save(ws: Workspace): Promise<Workspace>;
}

export interface WorkspaceAgent {
  id: string;
  name: string;
  description?: string;
  userId: string;
  status: string;
  employeeNumber: number;
  lastActive: string;
  createdAt: string;
  source: 'cluster-instance';
}

export class WorkspaceService {
  private repo: IWorkspaceRepository;
  private workspaceBackendClient: WorkspaceBackendClient;
  private marketplaceClient: MarketplaceClient | null;
  private clusterInstanceClient: ClusterInstanceClient | null;

  constructor(
    repo: IWorkspaceRepository,
    workspaceBackendClient: WorkspaceBackendClient,
    marketplaceClient?: MarketplaceClient,
    clusterInstanceClient?: ClusterInstanceClient
  ) {
    this.repo = repo;
    this.workspaceBackendClient = workspaceBackendClient;
    this.marketplaceClient = marketplaceClient ?? null;
    this.clusterInstanceClient = clusterInstanceClient ?? null;
  }

  /** AI 工作区后端（workspace-backend）未配置时，所有依赖它的操作明确拒绝，而非崩溃。 */
  private requireWorkspaceBackend(): void {
    if (!this.workspaceBackendClient.isConfigured()) {
      throw new Error(
        'AI workspace backend (workspace-backend) not configured — set WORKSPACE_BACKEND_API_URL or disable workspace features'
      );
    }
  }

  async listByOwner(ownerId: string): Promise<Workspace[]> {
    return this.repo.findByOwner(ownerId);
  }

  async get(id: string): Promise<Workspace> {
    const ws = await this.repo.findById(id);
    if (!ws) throw new Error(`Workspace ${id} not found`);
    return ws;
  }

  async create(params: {
    name: string;
    type: WorkspaceType;
    ownerId: string;
    tenantId: string;
    description?: string;
    sourceChannel?: string;
    sourceConversationId?: string;
  }): Promise<Workspace> {
    this.requireWorkspaceBackend();
    const ws = createWorkspace(params);
    await this.repo.save(ws);
    await this.workspaceBackendClient.createWorkspace({
      name: ws.name,
      type: ws.type,
      userId: ws.ownerId,
    });
    return ws;
  }

  async createFromChat(params: {
    channelType: string;
    conversationId: string;
    prompt: string;
    ownerId: string;
    tenantId: string;
    type?: WorkspaceType;
  }): Promise<Workspace> {
    const name =
      params.prompt
        .slice(0, 50)
        .replace(/[^\w一-鿿\s-]/g, '')
        .trim() || 'workspace';
    return this.create({
      name,
      type: params.type ?? 'AGENT',
      ownerId: params.ownerId,
      tenantId: params.tenantId,
      description: params.prompt,
      sourceChannel: params.channelType,
      sourceConversationId: params.conversationId,
    });
  }

  async generateStream(
    workspaceId: string,
    prompt: string,
    options?: { model?: string; conversationId?: string; agentId?: string },
    authToken?: string
  ): Promise<Response> {
    this.requireWorkspaceBackend();
    return this.workspaceBackendClient.generateStream(workspaceId, prompt, options, authToken);
  }

  async listAgents(_ownerId: string, _authToken?: string): Promise<WorkspaceAgent[]> {
    if (!this.clusterInstanceClient?.isConfigured()) {
      return [];
    }
    const res = await this.clusterInstanceClient.listInstances();
    return res.items
      .filter((i) => i.isActive)
      .map(
        (i): WorkspaceAgent => ({
          id: `emp-${i.employeeNumber}`,
          name: i.name || `数字员工 #${i.employeeNumber}`,
          userId: i.userId,
          status: i.status,
          employeeNumber: i.employeeNumber,
          lastActive: i.lastActive,
          createdAt: i.createdAt,
          source: 'cluster-instance',
        })
      );
  }

  async installSkill(workspaceId: string, skillId: string, authToken?: string): Promise<unknown> {
    this.requireWorkspaceBackend();
    if (this.marketplaceClient?.isConfigured()) {
      await this.marketplaceClient.downloadSkill(skillId, undefined, authToken);
    }
    return this.workspaceBackendClient.addWorkspaceSkill(workspaceId, skillId, authToken);
  }

  async listConversations(workspaceId: string): Promise<WorkspaceConversation[]> {
    this.requireWorkspaceBackend();
    const data = await this.workspaceBackendClient.listConversations(workspaceId);
    const arr = (data as Record<string, unknown>)?.conversations;
    return Array.isArray(arr) ? (arr as WorkspaceConversation[]) : [];
  }

  async sendMessage(
    workspaceId: string,
    conversationId: string,
    content: string,
    sender: string
  ): Promise<unknown> {
    this.requireWorkspaceBackend();
    return this.workspaceBackendClient.sendMessage(workspaceId, conversationId, {
      content,
      role: sender,
    });
  }

  async listApps(workspaceId: string): Promise<WorkspaceApp[]> {
    this.requireWorkspaceBackend();
    const data = await this.workspaceBackendClient.listApps(workspaceId);
    const arr = (data as Record<string, unknown>)?.apps;
    return Array.isArray(arr) ? (arr as WorkspaceApp[]) : [];
  }

  async deployApp(workspaceId: string, appId: string): Promise<unknown> {
    this.requireWorkspaceBackend();
    return this.workspaceBackendClient.deployApp(workspaceId, appId);
  }
}
