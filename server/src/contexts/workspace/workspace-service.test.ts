import { describe, it, expect, vi } from 'vitest';
import { WorkspaceService, type IWorkspaceRepository } from './workspace-service.js';
import type { XspaceClient } from '../gateway/clients/xspace-client.js';

function makeRepo(workspaces: any[] = []): IWorkspaceRepository {
  const store = new Map(workspaces.map((w) => [w.id, w]));
  return {
    findByOwner: vi.fn(async (ownerId: string) =>
      Array.from(store.values()).filter((w) => w.ownerId === ownerId)
    ),
    findById: vi.fn(async (id: string) => store.get(id) || null),
    save: vi.fn(async (ws) => {
      store.set(ws.id, ws);
      return ws;
    }),
  };
}

function makeXspaceClient(overrides: Partial<XspaceClient> = {}): XspaceClient {
  return {
    createWorkspace: vi.fn(async () => ({ success: true })),
    listConversations: vi.fn(async () => ({ conversations: [{ id: 'conv-1', title: '对话1' }] })),
    sendMessage: vi.fn(async () => ({ sent: true })),
    listApps: vi.fn(async () => ({ apps: [{ id: 'app-1', name: '应用1' }] })),
    deployApp: vi.fn(async () => ({ deployed: true })),
    ...overrides,
  } as unknown as XspaceClient;
}

describe('WorkspaceService', () => {
  it("listByOwner returns owner's workspaces", async () => {
    const ws = { id: 'ws-1', name: 'W1', ownerId: 'u1', type: 'personal' };
    const svc = new WorkspaceService(makeRepo([ws]), makeXspaceClient());
    const result = await svc.listByOwner('u1');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('W1');
  });

  it('get returns workspace', async () => {
    const ws = { id: 'ws-1', name: 'W1', ownerId: 'u1', type: 'personal' };
    const svc = new WorkspaceService(makeRepo([ws]), makeXspaceClient());
    const result = await svc.get('ws-1');
    expect(result.id).toBe('ws-1');
  });

  it('get throws for unknown id', async () => {
    const svc = new WorkspaceService(makeRepo(), makeXspaceClient());
    await expect(svc.get('nope')).rejects.toThrow('not found');
  });

  it('create saves to repo and calls xspace', async () => {
    const repo = makeRepo();
    const xspace = makeXspaceClient();
    const svc = new WorkspaceService(repo, xspace);
    const result = await svc.create({
      name: '新空间',
      type: 'team',
      ownerId: 'u1',
      tenantId: 'tn_1',
    });
    expect(result.name).toBe('新空间');
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(xspace.createWorkspace).toHaveBeenCalledTimes(1);
  });

  it('listConversations delegates to xspace client', async () => {
    const svc = new WorkspaceService(makeRepo(), makeXspaceClient());
    const result = await svc.listConversations('ws-1');
    expect(result).toHaveLength(1);
  });

  it('sendMessage delegates to xspace client', async () => {
    const xspace = makeXspaceClient();
    const svc = new WorkspaceService(makeRepo(), xspace);
    await svc.sendMessage('ws-1', 'conv-1', 'hello', 'user');
    expect(xspace.sendMessage).toHaveBeenCalledWith('ws-1', 'conv-1', {
      content: 'hello',
      role: 'user',
    });
  });

  it('listApps delegates to xspace client', async () => {
    const svc = new WorkspaceService(makeRepo(), makeXspaceClient());
    const result = await svc.listApps('ws-1');
    expect(result).toHaveLength(1);
  });

  it('deployApp delegates to xspace client', async () => {
    const xspace = makeXspaceClient();
    const svc = new WorkspaceService(makeRepo(), xspace);
    await svc.deployApp('ws-1', 'app-1');
    expect(xspace.deployApp).toHaveBeenCalledWith('ws-1', 'app-1');
  });

  it('createFromChat creates workspace with channel source', async () => {
    const repo = makeRepo();
    const xspace = makeXspaceClient();
    const svc = new WorkspaceService(repo, xspace);
    const result = await svc.createFromChat({
      channelType: 'matrix',
      conversationId: 'room-123',
      prompt: '创建一个数据分析技能',
      ownerId: 'u1',
      tenantId: 'tn_1',
    });
    expect(result.sourceChannel).toBe('matrix');
    expect(result.sourceConversationId).toBe('room-123');
    expect(result.description).toBe('创建一个数据分析技能');
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('listAgents delegates to claw-manager client', async () => {
    const xspace = makeXspaceClient({} as any);
    const clawManager = {
      isConfigured: () => true,
      listInstances: vi.fn(async () => ({
        items: [
          {
            userId: 'u1',
            employeeNumber: 1,
            name: 'TestAgent',
            status: 'running',
            isActive: true,
            lastActive: '2026-01-01',
            createdAt: '2026-01-01',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 100,
      })),
    } as any;
    const svc = new WorkspaceService(makeRepo(), xspace, undefined, clawManager);
    const agents = await svc.listAgents('u1');
    expect(agents).toHaveLength(1);
    expect(agents[0].name).toBe('TestAgent');
    expect(agents[0].source).toBe('claw-manager');
  });

  it('installSkill adds skill to workspace', async () => {
    const xspace = makeXspaceClient({
      addWorkspaceSkill: vi.fn(async () => ({ success: true })),
    } as any);
    const svc = new WorkspaceService(makeRepo(), xspace);
    await svc.installSkill('ws-1', 'skill-abc');
    expect(xspace.addWorkspaceSkill).toHaveBeenCalledWith('ws-1', 'skill-abc', undefined);
  });
});
