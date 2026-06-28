import { describe, it, expect, vi } from 'vitest';
import { ToolApprovalService } from './tool-approval-service.js';
import type {
  ToolApprovalRepository,
  ToolApprovalRow,
} from '../../../db/repositories/tool-approvals-repository.js';
import type { ToolManagementService } from '../tool-management-service.js';
import type { AuditService } from '../../audit-observability/audit-service.js';

function makeApproval(overrides: Partial<ToolApprovalRow> = {}): ToolApprovalRow {
  return {
    id: 'ap1',
    tenantId: 't1',
    toolId: 'tool1',
    toolName: 'T',
    riskLevel: 'high',
    instanceId: null,
    params: {},
    context: {},
    status: 'pending',
    requestedBy: null,
    reviewedBy: null,
    reviewNote: null,
    result: null,
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    ...overrides,
  };
}

function makeRepo(approval: ToolApprovalRow | null) {
  return {
    findById: vi.fn(async () => approval),
    update: vi.fn(async () => approval),
    findPending: vi.fn(async () => []),
    create: vi.fn(),
  } as unknown as ToolApprovalRepository;
}

function makeToolMgmt(result: unknown = { ok: true }) {
  return { executeTool: vi.fn(async () => result) } as unknown as ToolManagementService;
}

describe('ToolApprovalService', () => {
  it('approve: not found throws 404', async () => {
    const svc = new ToolApprovalService(makeRepo(null), makeToolMgmt());
    await expect(svc.approve('x', 'admin')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('approve: already processed throws 409', async () => {
    const svc = new ToolApprovalService(
      makeRepo(makeApproval({ status: 'approved' })),
      makeToolMgmt()
    );
    await expect(svc.approve('ap1', 'admin')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('approve: pending → approved + executeTool + result + audit', async () => {
    const approval = makeApproval();
    const repo = makeRepo(approval);
    const toolMgmt = makeToolMgmt({ data: 'exec-result' });
    const audit = { log: vi.fn() } as unknown as AuditService;
    const svc = new ToolApprovalService(repo, toolMgmt, audit);
    const result = await svc.approve('ap1', 'alice');
    expect(result.status).toBe('approved');
    expect(result.result).toEqual({ data: 'exec-result' });
    expect(repo.update).toHaveBeenCalledWith(
      'ap1',
      expect.objectContaining({ status: 'approved', reviewedBy: 'alice' })
    );
    expect(toolMgmt.executeTool).toHaveBeenCalledWith('tool1', {}, {});
    expect(audit.log).toHaveBeenCalled();
  });

  it('approve: executeTool error captured in result (not throw)', async () => {
    const approval = makeApproval();
    const repo = makeRepo(approval);
    const toolMgmt = {
      executeTool: vi.fn(async () => {
        throw new Error('boom');
      }),
    } as unknown as ToolManagementService;
    const svc = new ToolApprovalService(repo, toolMgmt);
    const result = await svc.approve('ap1', 'alice');
    expect(result.result).toMatchObject({ success: false, error: 'boom' });
  });

  it('reject: not found throws 404', async () => {
    const svc = new ToolApprovalService(makeRepo(null), makeToolMgmt());
    await expect(svc.reject('x', 'admin')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('reject: already processed throws 409', async () => {
    const svc = new ToolApprovalService(
      makeRepo(makeApproval({ status: 'rejected' })),
      makeToolMgmt()
    );
    await expect(svc.reject('ap1', 'admin')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('reject: pending → rejected + reviewNote + audit', async () => {
    const approval = makeApproval();
    const repo = makeRepo(approval);
    const audit = { log: vi.fn() } as unknown as AuditService;
    const svc = new ToolApprovalService(repo, makeToolMgmt(), audit);
    const result = await svc.reject('ap1', 'bob', '不再需要');
    expect(result.status).toBe('rejected');
    expect(repo.update).toHaveBeenCalledWith(
      'ap1',
      expect.objectContaining({ status: 'rejected', reviewNote: '不再需要' })
    );
    expect(audit.log).toHaveBeenCalled();
  });
});
