import { describe, it, expect } from 'vitest';
import { Pattern } from './pattern.js';

describe('Pattern', () => {
  const FIXED_TS = 1_700_000_000_000;

  describe('create', () => {
    it('新建 pattern，默认 patternType=pattern + id pat- 前缀', () => {
      const p = Pattern.create({ pattern: '重复失败模式', data: { count: 3 } });
      expect(p.id).toMatch(/^pat-/);
      expect(p.patternType).toBe('pattern');
      expect(p.pattern).toBe('重复失败模式');
      expect(p.data).toEqual({ count: 3 });
      expect(p.isKnowledgePattern).toBe(false);
    });

    it('指定 patternType=knowledge_pattern', () => {
      const p = Pattern.create({ patternType: 'knowledge_pattern', pattern: 'k' });
      expect(p.patternType).toBe('knowledge_pattern');
      expect(p.isKnowledgePattern).toBe(true);
    });

    it('无 data 默认空对象', () => {
      const p = Pattern.create({ pattern: 'p' });
      expect(p.data).toEqual({});
    });
  });

  describe('fromProps', () => {
    const baseProps = {
      id: 'pat-1',
      patternType: 'knowledge_pattern' as const,
      pattern: 'p',
      data: { foo: 'bar' },
      createdAt: new Date(FIXED_TS),
    };

    it('从持久化 props 重建', () => {
      const p = Pattern.fromProps(baseProps);
      expect(p.id).toBe('pat-1');
      expect(p.patternType).toBe('knowledge_pattern');
      expect(p.data).toEqual({ foo: 'bar' });
    });

    it('非法 patternType 脏数据拒建', () => {
      expect(() => Pattern.fromProps({ ...baseProps, patternType: 'unknown' as never })).toThrow(
        /invalid patternType/
      );
    });

    it('toProps 往返等价', () => {
      const p = Pattern.create({ pattern: 'p', data: { x: 1 } });
      const roundtrip = Pattern.fromProps(p.toProps());
      expect(roundtrip.toProps()).toEqual(p.toProps());
    });

    it('data 缺省时容错空对象', () => {
      const p = Pattern.fromProps({
        ...baseProps,
        data: undefined as unknown as Record<string, unknown>,
      });
      expect(p.data).toEqual({});
    });
  });
});
