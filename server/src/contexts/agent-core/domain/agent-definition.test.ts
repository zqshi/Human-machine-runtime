import { describe, it, expect } from 'vitest';
import {
  validateAgentDefinitionSpec,
  defaultAgentDefinitionSpec,
  createAgentDefinition,
  bumpGeneration,
} from './agent-definition.js';

describe('validateAgentDefinitionSpec', () => {
  it('默认 spec 通过校验', () => {
    const spec = defaultAgentDefinitionSpec();
    const errors = validateAgentDefinitionSpec(spec);
    expect(errors).toEqual([]);
  });

  it('非法 sandboxTemplate 报错', () => {
    const spec = { ...defaultAgentDefinitionSpec(), sandboxTemplate: 'invalid' };
    const errors = validateAgentDefinitionSpec(spec);
    expect(errors.some((e) => e.field === 'sandboxTemplate')).toBe(true);
  });

  it('sandboxTemplate 合法值通过(basic/high-privilege/network-isolated)', () => {
    for (const t of ['basic', 'high-privilege', 'network-isolated']) {
      const spec = { ...defaultAgentDefinitionSpec(), sandboxTemplate: t };
      expect(validateAgentDefinitionSpec(spec).some((e) => e.field === 'sandboxTemplate')).toBe(false);
    }
  });

  it('非法 workspaceStrategy.size 报错', () => {
    const spec = {
      ...defaultAgentDefinitionSpec(),
      workspaceStrategy: { type: 'pvc', size: '999Gi' },
    };
    const errors = validateAgentDefinitionSpec(spec);
    expect(errors.some((e) => e.field === 'workspaceStrategy.size')).toBe(true);
  });

  it('modelConfig.maxConcurrency 越界报错(>100)', () => {
    const spec = {
      ...defaultAgentDefinitionSpec(),
      modelConfig: { primaryModel: 'auto', fallbackModels: [], maxConcurrency: 200 },
    };
    const errors = validateAgentDefinitionSpec(spec);
    expect(errors.some((e) => e.field === 'modelConfig.maxConcurrency')).toBe(true);
  });

  it('modelConfig.primaryModel 缺失报错', () => {
    const spec = {
      ...defaultAgentDefinitionSpec(),
      modelConfig: { primaryModel: '', fallbackModels: [], maxConcurrency: 5 },
    };
    const errors = validateAgentDefinitionSpec(spec);
    expect(errors.some((e) => e.field === 'modelConfig.primaryModel')).toBe(true);
  });
});

describe('createAgentDefinition', () => {
  it('创建 CRD:generation 默认 1,id 含 adef 前缀', () => {
    const def = createAgentDefinition({
      tenantId: 'tn_demo',
      name: '报销助手',
      spec: defaultAgentDefinitionSpec(),
    });
    expect(def.id).toMatch(/^adef_/);
    expect(def.generation).toBe(1);
    expect(def.status).toBe('active');
    expect(def.spec.sandboxTemplate).toBe('basic');
    expect(def.spec.boundTools).toEqual([]);
  });

  it('description 可选', () => {
    const def = createAgentDefinition({
      tenantId: 'tn',
      name: 'n',
      spec: defaultAgentDefinitionSpec(),
    });
    expect(def.description).toBeNull();
  });
});

describe('bumpGeneration', () => {
  it('spec 变更 generation 递增', () => {
    const def = createAgentDefinition({
      tenantId: 'tn',
      name: 'n',
      spec: defaultAgentDefinitionSpec(),
    });
    const bumped = bumpGeneration(def);
    expect(bumped.generation).toBe(2);
    expect(def.generation).toBe(1); // 原对象不变(纯函数)
  });
});
