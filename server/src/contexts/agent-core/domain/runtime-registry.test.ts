import { describe, it, expect } from 'vitest';
import {
  RuntimeRegistry,
  BUILTIN_SANDBOX_TEMPLATES,
  DEFAULT_SANDBOX_TEMPLATE,
} from './runtime-registry.js';

describe('RuntimeRegistry', () => {
  const registry = new RuntimeRegistry();

  describe('mapRuntimeType(治本 D8 声明态→adapter 映射)', () => {
    it('claude → claude-agent-sdk adapter', () => {
      expect(registry.mapRuntimeType('claude')).toBe('claude-agent-sdk');
    });

    it('cockpit → cockpit adapter', () => {
      expect(registry.mapRuntimeType('cockpit')).toBe('cockpit');
    });

    it('hermes → custom adapter(待 hermes adapter 实现后改)', () => {
      expect(registry.mapRuntimeType('hermes')).toBe('custom');
    });
  });

  describe('getSandboxTemplate', () => {
    it('basic 模板存在 + 字段完整', () => {
      const t = registry.getSandboxTemplate('basic');
      expect(t).not.toBeNull();
      expect(t?.name).toBe('basic');
      expect(t?.networkMode).toBe('bridge');
      expect(t?.highPrivilege).toBe(false);
    });

    it('high-privilege 模板 highPrivilege=true', () => {
      const t = registry.getSandboxTemplate('high-privilege');
      expect(t?.highPrivilege).toBe(true);
    });

    it('network-isolated 模板 networkMode=none', () => {
      const t = registry.getSandboxTemplate('network-isolated');
      expect(t?.networkMode).toBe('none');
    });

    it('未知模板 → null', () => {
      expect(registry.getSandboxTemplate('unknown')).toBeNull();
    });
  });

  describe('listSandboxTemplates', () => {
    it('返回 3 个内置模板', () => {
      const list = registry.listSandboxTemplates();
      expect(list).toHaveLength(3);
      expect(list.map((t) => t.name).sort()).toEqual([
        'basic',
        'high-privilege',
        'network-isolated',
      ]);
    });
  });

  describe('isValidSandboxTemplate', () => {
    it('内置模板名 → true', () => {
      for (const t of BUILTIN_SANDBOX_TEMPLATES) {
        expect(registry.isValidSandboxTemplate(t.name)).toBe(true);
      }
    });

    it('未知模板名 → false', () => {
      expect(registry.isValidSandboxTemplate('invalid')).toBe(false);
    });
  });

  it('DEFAULT_SANDBOX_TEMPLATE = basic', () => {
    expect(DEFAULT_SANDBOX_TEMPLATE).toBe('basic');
  });
});
