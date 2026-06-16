import type {
  Workspace,
  WorkspaceApp,
  WorkspaceConversation,
  WorkspaceType,
} from './domain/workspace.js';
import { createWorkspace } from './domain/workspace.js';
import type { XspaceClient } from '../gateway/clients/xspace-client.js';
import type { ClawHubClient } from '../gateway/clients/clawhub-client.js';
import type { ClawManagerClient } from '../gateway/clients/claw-manager-client.js';

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
  source: 'claw-manager';
}

export class WorkspaceService {
  private repo: IWorkspaceRepository;
  private xspaceClient: XspaceClient;
  private clawHubClient: ClawHubClient | null;
  private clawManagerClient: ClawManagerClient | null;

  constructor(
    repo: IWorkspaceRepository,
    xspaceClient: XspaceClient,
    clawHubClient?: ClawHubClient,
    clawManagerClient?: ClawManagerClient
  ) {
    this.repo = repo;
    this.xspaceClient = xspaceClient;
    this.clawHubClient = clawHubClient ?? null;
    this.clawManagerClient = clawManagerClient ?? null;
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
    const ws = createWorkspace(params);
    await this.repo.save(ws);
    await this.xspaceClient.createWorkspace({ name: ws.name, type: ws.type, userId: ws.ownerId });
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
    return this.xspaceClient.generateStream(workspaceId, prompt, options, authToken);
  }

  async listAgents(_ownerId: string, _authToken?: string): Promise<WorkspaceAgent[]> {
    if (!this.clawManagerClient?.isConfigured()) {
      return [];
    }
    const res = await this.clawManagerClient.listInstances();
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
          source: 'claw-manager',
        })
      );
  }

  async installSkill(workspaceId: string, skillId: string, authToken?: string): Promise<unknown> {
    if (this.clawHubClient?.isConfigured()) {
      await this.clawHubClient.downloadSkill(skillId, undefined, authToken);
    }
    return this.xspaceClient.addWorkspaceSkill(workspaceId, skillId, authToken);
  }

  async listConversations(workspaceId: string): Promise<WorkspaceConversation[]> {
    const data = await this.xspaceClient.listConversations(workspaceId);
    const arr = (data as Record<string, unknown>)?.conversations;
    return Array.isArray(arr) ? (arr as WorkspaceConversation[]) : [];
  }

  async sendMessage(
    workspaceId: string,
    conversationId: string,
    content: string,
    sender: string
  ): Promise<unknown> {
    return this.xspaceClient.sendMessage(workspaceId, conversationId, { content, role: sender });
  }

  async listApps(workspaceId: string): Promise<WorkspaceApp[]> {
    const data = await this.xspaceClient.listApps(workspaceId);
    const arr = (data as Record<string, unknown>)?.apps;
    return Array.isArray(arr) ? (arr as WorkspaceApp[]) : [];
  }

  async deployApp(workspaceId: string, appId: string): Promise<unknown> {
    return this.xspaceClient.deployApp(workspaceId, appId);
  }
}
