import { describe, it, expect, vi } from 'vitest';
import { ApprovalGate } from './approval-gate.js';
import { ApprovalPolicyService } from './approval-policy-service.js';

const baseInput = {
  toolRiskLevel: 'high' as const,
  tenantId: 'tn1',
  toolId: 'tool_1',
  toolName: '删除用户',
  params: { id: 'u1' },
  context: { tenantId: 'tn1' },
};

function makeGate(opts: {
  enforced?: boolean;
  instancePolicy?: { enabled: true; requireApprovalLevels: ['high'] } | null;
  instanceId?: string;
}) {
  const policyService = new ApprovalPolicyService();
  const instancePolicyPort = {
    getApprovalPolicy: vi.fn(async () => opts.instancePolicy ?? null),
  };
  const approvalRepo = {
    create: vi.fn(async (i: { id: string }) => ({ id: i.id, ...i, status: 'pending' })),
  };
  const configService = {
    isFeatureEnabled: vi.fn(async () => opts.enforced ?? false),
  };
  const gate = new ApprovalGate(
    policyService,
    instancePolicyPort,
    approvalRepo as never,
    configService as never
  );
  return { gate, instancePolicyPort, approvalRepo, configService };
}

describe('ApprovalGate.checkAndMaybeBlock (#7)', () => {
  it('feature flag 未启用 → 不拦截(向后兼容)', async () => {
    const { gate, approvalRepo } = makeGate({ enforced: false });
    const r = await gate.checkAndMaybeBlock({ ...baseInput, instanceId: 'inst1' });
    expect(r.blocked).toBe(false);
    expect(approvalRepo.create).not.toHaveBeenCalled();
  });

  it('enforce + high + 实例配 [high] → 拦截 + 创建 pending', async () => {
    const { gate, approvalRepo } = makeGate({
      enforced: true,
      instancePolicy: { enabled: true, requireApprovalLevels: ['high'] },
    });
    const r = await gate.checkAndMaybeBlock({ ...baseInput, instanceId: 'inst1' });
    expect(r.blocked).toBe(true);
    expect(r.approvalId).toMatch(/^tapr_/);
    expect(r.reason).toContain('requires human approval');
    expect(approvalRepo.create).toHaveBeenCalledOnce();
  });

  it('enforce + medium + 实例配 [high] → 不拦截(medium 不在审批范围)', async () => {
    const { gate, approvalRepo } = makeGate({
      enforced: true,
      instancePolicy: { enabled: true, requireApprovalLevels: ['high'] },
    });
    const r = await gate.checkAndMaybeBlock({
      ...baseInput,
      toolRiskLevel: 'medium',
      instanceId: 'inst1',
    });
    expect(r.blocked).toBe(false);
    expect(approvalRepo.create).not.toHaveBeenCalled();
  });

  it('enforce + high + 实例未配 policy → 不拦截(默认不审批)', async () => {
    const { gate } = makeGate({ enforced: true, instancePolicy: null });
    const r = await gate.checkAndMaybeBlock({ ...baseInput, instanceId: 'inst1' });
    expect(r.blocked).toBe(false);
  });

  it('enforce + high + 无 instanceId → 不拦截(无实例无法查 policy)', async () => {
    const { gate, instancePolicyPort } = makeGate({
      enforced: true,
      instancePolicy: { enabled: true, requireApprovalLevels: ['high'] },
    });
    const r = await gate.checkAndMaybeBlock(baseInput);
    expect(r.blocked).toBe(false);
    expect(instancePolicyPort.getApprovalPolicy).not.toHaveBeenCalled();
  });

  it('instancePolicyPort 抛异常 → 容错不拦截(不阻断主链路)', async () => {
    const policyService = new ApprovalPolicyService();
    const instancePolicyPort = {
      getApprovalPolicy: vi.fn(async () => {
        throw new Error('db down');
      }),
    };
    const approvalRepo = { create: vi.fn() };
    const configService = { isFeatureEnabled: vi.fn(async () => true) };
    const gate = new ApprovalGate(
      policyService,
      instancePolicyPort,
      approvalRepo as never,
      configService as never
    );
    const r = await gate.checkAndMaybeBlock({ ...baseInput, instanceId: 'inst1' });
    expect(r.blocked).toBe(false);
    expect(approvalRepo.create).not.toHaveBeenCalled();
  });

  it('拦截时 approval 记录含完整快照(params/context/requestedBy)', async () => {
    const { gate, approvalRepo } = makeGate({
      enforced: true,
      instancePolicy: { enabled: true, requireApprovalLevels: ['high'] },
    });
    await gate.checkAndMaybeBlock({
      ...baseInput,
      instanceId: 'inst1',
      requestedBy: 'agent_x',
    });
    const arg = approvalRepo.create.mock.calls[0][0];
    expect(arg.params).toEqual({ id: 'u1' });
    expect(arg.instanceId).toBe('inst1');
    expect(arg.requestedBy).toBe('agent_x');
    expect(arg.riskLevel).toBe('high');
  });
});
