import { describe, it, expect } from 'vitest';
import { OrchestrationAgent, type OrchestrationAgentProps } from './orchestration-agent.js';

const baseProps = (): OrchestrationAgentProps => ({
  id: 'oag-1',
  agentId: 'agent-1',
  role: 'executor',
  status: 'registered',
  metadata: { capabilities: ['tool-a'] },
  tenantId: 'tenant-1',
  registeredAt: new Date('2026-01-01T00:00:00Z'),
});

describe('OrchestrationAgent', () => {
  describe('create', () => {
    it('默认 status=registered / metadata 空 / registeredAt now / id oag- 前缀', () => {
      const a = OrchestrationAgent.create({ agentId: 'a1' });
      expect(a.id).toMatch(/^oag-\d+-[a-z0-9]+$/);
      expect(a.status).toBe('registered');
      expect(a.metadata).toEqual({});
      expect(a.registeredAt).toBeInstanceOf(Date);
      expect(a.isRegistered).toBe(true);
    });

    it('透传字段 + status 枚举校验', () => {
      const a = OrchestrationAgent.create({
        agentId: 'a1',
        role: 'reviewer',
        status: 'active',
        metadata: { k: 'v' },
        tenantId: 't1',
      });
      expect(a.agentId).toBe('a1');
      expect(a.role).toBe('reviewer');
      expect(a.status).toBe('active');
      expect(a.isActive).toBe(true);
    });

    it('create 非法 status 抛错', () => {
      expect(() => OrchestrationAgent.create({ status: 'pending' as never })).toThrow(
        /invalid status/
      );
    });

    it('create metadata 非对象规整为 {}', () => {
      const a = OrchestrationAgent.create({ metadata: 'x' as never });
      expect(a.metadata).toEqual({});
    });
  });

  describe('fromProps', () => {
    it('校验 status 不变式，脏 status 拒建', () => {
      expect(() =>
        OrchestrationAgent.fromProps({ ...baseProps(), status: 'pending' as never })
      ).toThrow(/invalid status/);
    });
  });

  describe('rehydrate', () => {
    it('脏 status fallback registered（不抛错）', () => {
      const a = OrchestrationAgent.rehydrate({
        ...baseProps(),
        status: 'garbage',
        metadata: null,
      });
      expect(a.status).toBe('registered');
      expect(a.metadata).toEqual({});
    });

    it('合法 status 保留', () => {
      const a = OrchestrationAgent.rehydrate({ ...baseProps(), status: 'active' });
      expect(a.status).toBe('active');
    });
  });

  describe('toProps round-trip', () => {
    it('fromProps(toProps()) 恒等', () => {
      const a = OrchestrationAgent.fromProps(baseProps());
      expect(OrchestrationAgent.fromProps(a.toProps()).toProps()).toEqual(a.toProps());
    });
  });
});
