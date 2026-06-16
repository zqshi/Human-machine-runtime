import { eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { agentProfiles } from '../schema/agent-profile.js';
import { newId } from '../../shared/utils.js';

export interface AgentProfileRow {
  id: string;
  instanceId: string;
  tenantId: string;
  displayName: string | null;
  avatar: string | null;
  knowMe: string | null;
  skillsDigest: string | null;
  personality: string | null;
  settings: Record<string, unknown>;
  milestones: unknown[];
  syncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export class AgentProfileRepository {
  constructor(private db: Database) {}

  async findByInstanceId(instanceId: string): Promise<AgentProfileRow | null> {
    const [row] = await this.db
      .select()
      .from(agentProfiles)
      .where(eq(agentProfiles.instanceId, instanceId))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async findByTenant(tenantId: string): Promise<AgentProfileRow[]> {
    const rows = await this.db
      .select()
      .from(agentProfiles)
      .where(eq(agentProfiles.tenantId, tenantId));
    return rows.map(toDomain);
  }

  async upsert(
    instanceId: string,
    tenantId: string,
    data: Partial<
      Omit<AgentProfileRow, 'id' | 'instanceId' | 'tenantId' | 'createdAt' | 'updatedAt'>
    >
  ): Promise<AgentProfileRow> {
    const existing = await this.findByInstanceId(instanceId);
    if (existing) {
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (data.displayName !== undefined) patch.displayName = data.displayName;
      if (data.avatar !== undefined) patch.avatar = data.avatar;
      if (data.knowMe !== undefined) patch.knowMe = data.knowMe;
      if (data.skillsDigest !== undefined) patch.skillsDigest = data.skillsDigest;
      if (data.personality !== undefined) patch.personality = data.personality;
      if (data.settings !== undefined) patch.settings = { ...existing.settings, ...data.settings };
      if (data.milestones !== undefined) patch.milestones = data.milestones;

      await this.db
        .update(agentProfiles)
        .set(patch)
        .where(eq(agentProfiles.instanceId, instanceId));
      return (await this.findByInstanceId(instanceId))!;
    }

    const id = newId('profile');
    await this.db.insert(agentProfiles).values({
      id,
      instanceId,
      tenantId,
      displayName: data.displayName ?? null,
      avatar: data.avatar ?? null,
      knowMe: data.knowMe ?? null,
      skillsDigest: data.skillsDigest ?? null,
      personality: data.personality ?? null,
      settings: data.settings ?? {},
      milestones: data.milestones ?? [],
      syncedAt: data.syncedAt ? new Date(data.syncedAt) : null,
    });
    return (await this.findByInstanceId(instanceId))!;
  }

  async delete(instanceId: string): Promise<boolean> {
    const result = await this.db
      .delete(agentProfiles)
      .where(eq(agentProfiles.instanceId, instanceId));
    return (result as unknown as { rowCount: number }).rowCount > 0;
  }
}

function toDomain(row: typeof agentProfiles.$inferSelect): AgentProfileRow {
  return {
    id: row.id,
    instanceId: row.instanceId,
    tenantId: row.tenantId,
    displayName: row.displayName ?? null,
    avatar: row.avatar ?? null,
    knowMe: row.knowMe ?? null,
    skillsDigest: row.skillsDigest ?? null,
    personality: row.personality ?? null,
    settings: (row.settings ?? {}) as Record<string, unknown>,
    milestones: (row.milestones ?? []) as unknown[],
    syncedAt: row.syncedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
