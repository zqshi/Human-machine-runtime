import { describe, it, expect } from 'vitest';
import { ApprovalPolicyService, type InstanceApprovalPolicy } from './approval-policy-service.js';
import type { RiskLevel } from '../types.js';

describe('ApprovalPolicyService.shouldApprove (#7)', () => {
  const svc = new ApprovalPolicyService();

  it('approvalPolicy=null → 不审批(直接执行)', () => {
    expect(svc.shouldApprove('high', null)).toBe(false);
  });

  it('enabled=false → 不审批', () => {
    const policy: InstanceApprovalPolicy = { enabled: false, requireApprovalLevels: ['high'] };
    expect(svc.shouldApprove('high', policy)).toBe(false);
  });

  it('riskLevel high + requireApprovalLevels [high] → 需审批', () => {
    const policy: InstanceApprovalPolicy = { enabled: true, requireApprovalLevels: ['high'] };
    expect(svc.shouldApprove('high', policy)).toBe(true);
  });

  it('riskLevel medium + requireApprovalLevels [high] → 不审批', () => {
    const policy: InstanceApprovalPolicy = { enabled: true, requireApprovalLevels: ['high'] };
    expect(svc.shouldApprove('medium', policy)).toBe(false);
  });

  it('requireApprovalLevels 缺省 → 默认 [high](仅 high 需审批)', () => {
    const policy: InstanceApprovalPolicy = { enabled: true };
    expect(svc.shouldApprove('high', policy)).toBe(true);
    expect(svc.shouldApprove('medium', policy)).toBe(false);
    expect(svc.shouldApprove('low', policy)).toBe(false);
  });

  it('requireApprovalLevels [medium,high] → medium/high 需审批,low 不审批', () => {
    const policy: InstanceApprovalPolicy = {
      enabled: true,
      requireApprovalLevels: ['medium', 'high'],
    };
    expect(svc.shouldApprove('low', policy)).toBe(false);
    expect(svc.shouldApprove('medium', policy)).toBe(true);
    expect(svc.shouldApprove('high', policy)).toBe(true);
  });

  it('defaultPolicy() = { enabled:true, requireApprovalLevels:[high] }', () => {
    expect(svc.defaultPolicy()).toEqual({ enabled: true, requireApprovalLevels: ['high'] });
  });
});
