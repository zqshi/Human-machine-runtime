import { describe, it, expect } from 'vitest';
import { Notification } from '../Notification';
import { Approval } from '../Approval';

describe('Notification', () => {
  const base = {
    id: 'n1',
    type: 'mention' as const,
    title: '新消息提醒',
    body: 'Alice mentioned you in group chat',
    timestamp: '2026-03-06T10:00:00Z',
    read: false,
    sender: { name: 'Alice' },
    roomId: '!room1:server',
  };

  it('creates a notification', () => {
    const n = Notification.create(base);
    expect(n.id).toBe('n1');
    expect(n.type).toBe('mention');
    expect(n.sender.name).toBe('Alice');
    expect(n.isUnread).toBe(true);
  });

  it('marks as read (immutable)', () => {
    const n = Notification.create(base);
    const read = n.markAsRead();
    expect(read.read).toBe(true);
    expect(read.isUnread).toBe(false);
    expect(n.read).toBe(false); // original unchanged
  });

  it('handles optional roomId', () => {
    const n = Notification.create({ ...base, roomId: undefined });
    expect(n.roomId).toBeUndefined();
  });
});

describe('Approval', () => {
  const base = {
    id: 'a1',
    type: 'leave' as const,
    title: '年假申请',
    applicant: { name: 'Bob', department: 'R&D' },
    status: 'pending' as const,
    createdAt: '2026-03-05T09:00:00Z',
  };

  it('creates a pending approval', () => {
    const a = Approval.create(base);
    expect(a.isPending).toBe(true);
    expect(a.applicant.department).toBe('R&D');
  });

  it('approves immutably', () => {
    const a = Approval.create(base);
    const approved = a.approve();
    expect(approved.status).toBe('approved');
    expect(a.status).toBe('pending');
  });

  it('rejects with reason', () => {
    const a = Approval.create(base);
    const rejected = a.reject('预算不足');
    expect(rejected.status).toBe('rejected');
    expect(rejected.reason).toBe('预算不足');
  });
});
