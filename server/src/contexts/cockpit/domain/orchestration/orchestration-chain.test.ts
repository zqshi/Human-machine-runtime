import { describe, it, expect } from 'vitest';
import {
  OrchestrationChain,
  type OrchestrationChainProps,
  type OrchestrationStep,
} from './orchestration-chain.js';

const baseProps = (): OrchestrationChainProps => ({
  id: 'orch-1',
  name: '扩容链',
  steps: [{ stepId: 's1' }, { stepId: 's2' }, { stepId: 's3' }],
  currentStep: 0,
  status: 'active',
  agentId: 'agent-1',
  tenantId: 'tenant-1',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
});

describe('OrchestrationChain', () => {
  describe('create', () => {
    it('默认 status=active / currentStep=0 / steps 空 / id orch- 前缀', () => {
      const c = OrchestrationChain.create({ name: 'test' });
      expect(c.id).toMatch(/^orch-\d+-[a-z0-9]+$/);
      expect(c.status).toBe('active');
      expect(c.currentStep).toBe(0);
      expect(c.steps).toEqual([]);
      expect(c.createdAt).toBeInstanceOf(Date);
      expect(c.isActive).toBe(true);
      expect(c.isCompleted).toBe(false);
    });

    it('透传字段 + status 枚举校验', () => {
      const steps: OrchestrationStep[] = [{ stepId: 's1' }];
      const c = OrchestrationChain.create({
        name: '链',
        steps,
        currentStep: 2,
        status: 'completed',
        agentId: 'a1',
        tenantId: 't1',
      });
      expect(c.name).toBe('链');
      expect(c.steps).toEqual(steps);
      expect(c.currentStep).toBe(2);
      expect(c.status).toBe('completed');
      expect(c.agentId).toBe('a1');
      expect(c.tenantId).toBe('t1');
    });

    it('create 非法 status 抛错', () => {
      expect(() => OrchestrationChain.create({ status: 'running' as never })).toThrow(
        /invalid status/
      );
    });

    it('create currentStep 负数 clamp 到 0', () => {
      const c = OrchestrationChain.create({ currentStep: -5 });
      expect(c.currentStep).toBe(0);
    });

    it('create steps 非数组规整为 []', () => {
      const c = OrchestrationChain.create({ steps: 'not-array' as never });
      expect(c.steps).toEqual([]);
    });
  });

  describe('fromProps', () => {
    it('校验 status 不变式，脏 status 拒建', () => {
      expect(() =>
        OrchestrationChain.fromProps({ ...baseProps(), status: 'running' as never })
      ).toThrow(/invalid status/);
    });

    it('currentStep 负数 clamp', () => {
      const c = OrchestrationChain.fromProps({ ...baseProps(), currentStep: -1 });
      expect(c.currentStep).toBe(0);
    });

    it('steps 非数组规整为 []', () => {
      const c = OrchestrationChain.fromProps({ ...baseProps(), steps: null as never });
      expect(c.steps).toEqual([]);
    });
  });

  describe('rehydrate', () => {
    it('脏 status fallback active（不抛错）', () => {
      const c = OrchestrationChain.rehydrate({
        ...baseProps(),
        status: 'garbage',
        steps: 'not-array',
      });
      expect(c.status).toBe('active');
      expect(c.steps).toEqual([]);
    });

    it('合法 status 保留', () => {
      const c = OrchestrationChain.rehydrate({ ...baseProps(), status: 'paused' });
      expect(c.status).toBe('paused');
    });
  });

  describe('advance 状态机', () => {
    it('currentStep++ 且未到末步保持 active，返回新实例', () => {
      const c = OrchestrationChain.fromProps(baseProps()); // 3 steps, currentStep 0
      const next = c.advance();
      expect(next.currentStep).toBe(1);
      expect(next.status).toBe('active');
      expect(next).not.toBe(c); // 新实例
      expect(c.currentStep).toBe(0); // 原实例 immutable
    });

    it('到达末步 status=completed', () => {
      const c = OrchestrationChain.fromProps({ ...baseProps(), currentStep: 2 }); // 末步
      const next = c.advance();
      expect(next.currentStep).toBe(3);
      expect(next.status).toBe('completed');
      expect(next.isCompleted).toBe(true);
    });

    it('空 steps advance 一次立即 completed', () => {
      const c = OrchestrationChain.create({});
      const next = c.advance();
      expect(next.currentStep).toBe(1);
      expect(next.status).toBe('completed');
    });

    it('advance 刷新 updatedAt', () => {
      const c = OrchestrationChain.fromProps(baseProps());
      const next = c.advance();
      expect(next.updatedAt.getTime()).toBeGreaterThanOrEqual(c.updatedAt.getTime());
    });
  });

  describe('toProps round-trip', () => {
    it('fromProps(toProps()) 恒等', () => {
      const c = OrchestrationChain.fromProps(baseProps());
      const p = c.toProps();
      expect(OrchestrationChain.fromProps(p).toProps()).toEqual(p);
    });
  });
});
