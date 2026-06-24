import { and, desc, eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { toolApprovals, type ToolApprovalStatus } from '../schema/tool-registry.js';

/**
 * ToolApprovalRepository — tool_approvals 审批队列持久化(#7)。
 *
 * 复刻 marketplace IApprovalStore 的 create/findPending/findById/update 语义。
 * repo 纯持久化,决策由 ApprovalPolicyService/ApprovalGate 负责。
 */
export interface ToolApprovalRow {
  id: string;
  tenantId: string;
  toolId: string;
  toolName: string;
  riskLevel: string;
  instanceId: string | null;
  params: Record<string, unknown>;
  context: Record<string, unknown>;
  status: ToolApprovalStatus;
  requestedBy: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  result: Record<string, unknown> | null;
  createdAt: string;
  reviewedAt: string | null;
}

export class ToolApprovalRepository {
  constructor(private db: Database) {}

  async create(input: {
    id: string;
    tenantId: string;
    toolId: string;
    toolName: string;
    riskLevel: string;
    instanceId?: string | null;
    params: Record<string, unknown>;
    context: Record<string, unknown>;
    requestedBy?: string | null;
  }): Promise<ToolApprovalRow> {
    const [row] = await this.db
      .insert(toolApprovals)
      .values({
        id: input.id,
        tenantId: input.tenantId,
        toolId: input.toolId,
        toolName: input.toolName,
        riskLevel: input.riskLevel,
        instanceId: input.instanceId ?? null,
        params: input.params,
        context: input.context,
        status: 'pending',
        requestedBy: input.requestedBy ?? null,
      })
      .returning();
    return toRow(row);
  }

  async findById(id: string): Promise<ToolApprovalRow | null> {
    const [row] = await this.db
      .select()
      .from(toolApprovals)
      .where(eq(toolApprovals.id, id))
      .limit(1);
    return row ? toRow(row) : null;
  }

  async findPending(
    tenantId?: string,
    limit = 50,
    offset = 0
  ): Promise<ToolApprovalRow[]> {
    const conditions = [eq(toolApprovals.status, 'pending')];
    if (tenantId) conditions.push(eq(toolApprovals.tenantId, tenantId));
    const rows = await this.db
      .select()
      .from(toolApprovals)
      .where(and(...conditions))
      .orderBy(desc(toolApprovals.createdAt))
      .limit(limit)
      .offset(offset);
    return rows.map(toRow);
  }

  async update(
    id: string,
    patch: {
      status?: ToolApprovalStatus;
      reviewedBy?: string | null;
      reviewNote?: string | null;
      result?: Record<string, unknown> | null;
      reviewedAt?: Date | null;
    }
  ): Promise<ToolApprovalRow | null> {
    const [row] = await this.db
      .update(toolApprovals)
      .set(patch)
      .where(eq(toolApprovals.id, id))
      .returning();
    return row ? toRow(row) : null;
  }
}

function toRow(row: typeof toolApprovals.$inferSelect): ToolApprovalRow {
  return {
    id: row.id,
    tenantId: row.tenantId,
    toolId: row.toolId,
    toolName: row.toolName,
    riskLevel: row.riskLevel,
    instanceId: row.instanceId,
    params: row.params,
    context: row.context,
    status: row.status as ToolApprovalStatus,
    requestedBy: row.requestedBy,
    reviewedBy: row.reviewedBy,
    reviewNote: row.reviewNote,
    result: row.result,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
  };
}
