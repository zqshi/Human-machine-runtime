import { eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { workspaces } from '../schema/operational.js';
import type { Workspace } from '../../contexts/workspace/domain/workspace.js';
import type { IWorkspaceRepository } from '../../contexts/workspace/workspace-service.js';

export class WorkspaceRepository implements IWorkspaceRepository {
  constructor(private db: Database) {}

  async findByWorkspaceBackendId(workspaceBackendWorkspaceId: string): Promise<Workspace | null> {
    const rows = await this.db.select().from(workspaces);
    const match = rows.find((row) => {
      const data = (row.data ?? {}) as Record<string, unknown>;
      return data.workspaceBackendWorkspaceId === workspaceBackendWorkspaceId;
    });
    return match ? toWorkspace(match) : null;
  }

  async findByOwner(ownerId: string): Promise<Workspace[]> {
    const rows = await this.db.select().from(workspaces).where(eq(workspaces.ownerId, ownerId));
    return rows.map(toWorkspace);
  }

  async findById(id: string): Promise<Workspace | null> {
    const [row] = await this.db.select().from(workspaces).where(eq(workspaces.id, id));
    return row ? toWorkspace(row) : null;
  }

  async save(ws: Workspace): Promise<Workspace> {
    const existing = await this.db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.id, ws.id));

    const { id, name, type, ownerId, status, description, tenantId, metadata, ...rest } = ws;
    const data = { tenantId, metadata, ...rest };

    if (existing.length > 0) {
      await this.db
        .update(workspaces)
        .set({ name, type, ownerId, status, description, data, updatedAt: new Date() })
        .where(eq(workspaces.id, id));
    } else {
      await this.db.insert(workspaces).values({
        id,
        name,
        type,
        ownerId,
        status,
        description,
        data,
      });
    }
    return ws;
  }
}

function toWorkspace(row: typeof workspaces.$inferSelect): Workspace {
  const data = (row.data ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    name: row.name,
    type: (row.type as Workspace['type']) || 'NORMAL',
    ownerId: row.ownerId,
    tenantId: (data.tenantId as string) || '',
    description: row.description || '',
    status: (row.status as Workspace['status']) || 'active',
    workspaceBackendWorkspaceId: (data.workspaceBackendWorkspaceId as string) || undefined,
    sourceChannel: (data.sourceChannel as string) || undefined,
    sourceConversationId: (data.sourceConversationId as string) || undefined,
    createdAt: row.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: row.updatedAt?.toISOString() || new Date().toISOString(),
    metadata: (data.metadata as Record<string, unknown>) || {},
  };
}
