import { describe, it, expect } from 'vitest';
import { Approval, type ApprovalProps } from '../Approval';

const baseProps: ApprovalProps = {
  id: 'apr-1',
  type: 'leave',
  title: '年假申请',
  applicant: { name: 'Alice', department: 'Engineering' },
  status: 'pending',
  amount: undefined,
  createdAt: '2026-05-01T08:00:00Z',
};

describe('Approval', () => {
  it('creates from props', () => {
    const a = Approval.create(baseProps);
    expect(a.id).toBe('apr-1');
    expect(a.type).toBe('leave');
    expect(a.status).toBe('pending');
    expect(a.isPending).toBe(true);
  });

  it('approve changes status', () => {
    const a = Approval.create(baseProps);
    const approved = a.approve();
    expect(approved.status).toBe('approved');
    expect(approved.isPending).toBe(false);
    expect(approved.id).toBe('apr-1');
  });

  it('reject changes status and sets reason', () => {
    const a = Approval.create(baseProps);
    const rejected = a.reject('预算不足');
    expect(rejected.status).toBe('rejected');
    expect(rejected.reason).toBe('预算不足');
    expect(rejected.isPending).toBe(false);
  });

  it('preserves other fields after approve', () => {
    const a = Approval.create({ ...baseProps, amount: 5000, type: 'expense' });
    const approved = a.approve();
    expect(approved.amount).toBe(5000);
    expect(approved.type).toBe('expense');
    expect(approved.applicant.name).toBe('Alice');
  });

  it('is immutable — original unchanged after approve', () => {
    const a = Approval.create(baseProps);
    a.approve();
    expect(a.status).toBe('pending');
  });

  it('handles attachments', () => {
    const a = Approval.create({
      ...baseProps,
      attachments: [{ name: 'receipt.pdf', size: 1024 }],
    });
    expect(a.attachments).toHaveLength(1);
    expect(a.attachments![0].name).toBe('receipt.pdf');
  });
});
