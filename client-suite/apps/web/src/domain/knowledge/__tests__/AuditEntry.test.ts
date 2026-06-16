import { describe, it, expect } from 'vitest';
import { AuditEntry } from '../AuditEntry';

describe('AuditEntry', () => {
  const baseProps = {
    id: 'audit-1',
    timestamp: '2026-03-15T10:00:00Z',
    operatorId: 'user-1',
    operatorName: 'Alice',
    operationType: 'create' as const,
    targetId: 'doc-1',
    targetName: '产品需求文档',
    resourcePath: '知识库 / 官方指南 / 产品需求文档',
  };

  it('creates with defaults', () => {
    const entry = AuditEntry.create(baseProps);
    expect(entry.operatorName).toBe('Alice');
    expect(entry.operationType).toBe('create');
    expect(entry.ip).toBe('');
    expect(entry.metadata).toEqual({});
    expect(entry.operatorRole).toBe('');
  });

  it('creates with all fields', () => {
    const entry = AuditEntry.create({
      ...baseProps,
      operatorRole: '管理员',
      operatorAvatar: 'avatar.png',
      ip: '192.168.1.100',
      metadata: { browser: 'Chrome', os: 'macOS' },
    });
    expect(entry.ip).toBe('192.168.1.100');
    expect(entry.metadata.browser).toBe('Chrome');
    expect(entry.operatorRole).toBe('管理员');
  });

  it('operationLabel returns Chinese label', () => {
    expect(AuditEntry.create({ ...baseProps, operationType: 'create' }).operationLabel).toBe('创建');
    expect(AuditEntry.create({ ...baseProps, operationType: 'delete' }).operationLabel).toBe('删除');
    expect(AuditEntry.create({ ...baseProps, operationType: 'publish' }).operationLabel).toBe('发布');
    expect(AuditEntry.create({ ...baseProps, operationType: 'review_approve' }).operationLabel).toBe('审核通过');
    expect(AuditEntry.create({ ...baseProps, operationType: 'review_reject' }).operationLabel).toBe('审核驳回');
  });

  it('operationColor returns correct CSS class', () => {
    expect(AuditEntry.create({ ...baseProps, operationType: 'create' }).operationColor).toBe('text-green-500');
    expect(AuditEntry.create({ ...baseProps, operationType: 'delete' }).operationColor).toBe('text-red-500');
  });
});
