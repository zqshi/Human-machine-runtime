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

  it('sandboxTemplate 合法值通过(basic/high-privilege/network-isolated/kvm-microvm)', () => {
    for (const t of ['basic', 'high-privilege', 'network-isolated', 'kvm-microvm']) {
      const spec = { ...defaultAgentDefinitionSpec(), sandboxTemplate: t };
      expect(validateAgentDefinitionSpec(spec).some((e) => e.field === 'sandboxTemplate')).toBe(
        false
      );
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

describe('v1.9 persona/guardrails/runtime 声明态', () => {
  it('默认 spec 含 persona/boundKnowledge/runtime(空默认)且通过校验', () => {
    const spec = defaultAgentDefinitionSpec();
    expect(spec.persona).toEqual({ systemPrompt: '', guardrails: [], refusalResponse: '' });
    expect(spec.boundKnowledge).toEqual([]);
    expect(spec.runtime).toEqual({ runtimeType: 'claude' });
    expect(validateAgentDefinitionSpec(spec)).toEqual([]);
  });

  it('persona 缺失报错', () => {
    const spec = { ...defaultAgentDefinitionSpec(), persona: undefined as unknown as never };
    expect(validateAgentDefinitionSpec(spec).some((e) => e.field === 'persona')).toBe(true);
  });

  it('guardrail type 非法报错', () => {
    const spec = {
      ...defaultAgentDefinitionSpec(),
      persona: {
        systemPrompt: '你是客服',
        guardrails: [
          { id: 'g1', type: 'invalid', pattern: 'api key', action: 'block', reason: '越权' },
        ],
        refusalResponse: '拒绝',
      },
    };
    expect(
      validateAgentDefinitionSpec(spec).some((e) => e.field === 'persona.guardrails[0].type')
    ).toBe(true);
  });

  it('guardrail pattern 空/id 缺失报错', () => {
    const spec = {
      ...defaultAgentDefinitionSpec(),
      persona: {
        systemPrompt: '',
        guardrails: [{ id: '', type: 'keyword', pattern: '', action: 'block', reason: 'r' }],
        refusalResponse: '',
      },
    };
    const errors = validateAgentDefinitionSpec(spec);
    expect(errors.some((e) => e.field === 'persona.guardrails[0].id')).toBe(true);
    expect(errors.some((e) => e.field === 'persona.guardrails[0].pattern')).toBe(true);
  });

  it('guardrail action 合法值(block/review)通过', () => {
    for (const action of ['block', 'review'] as const) {
      const spec = {
        ...defaultAgentDefinitionSpec(),
        persona: {
          systemPrompt: '',
          guardrails: [{ id: 'g1', type: 'keyword', pattern: 'secret', action, reason: 'r' }],
          refusalResponse: '',
        },
      };
      expect(
        validateAgentDefinitionSpec(spec).some((e) => e.field === 'persona.guardrails[0].action')
      ).toBe(false);
    }
  });

  it('runtime.runtimeType 非法报错', () => {
    const spec = {
      ...defaultAgentDefinitionSpec(),
      runtime: { runtimeType: 'unknown' as never },
    };
    expect(validateAgentDefinitionSpec(spec).some((e) => e.field === 'runtime.runtimeType')).toBe(
      true
    );
  });

  it('runtime.runtimeType 合法值(claude/cockpit/hermes)通过', () => {
    for (const rt of ['claude', 'cockpit', 'hermes'] as const) {
      const spec = { ...defaultAgentDefinitionSpec(), runtime: { runtimeType: rt } };
      expect(validateAgentDefinitionSpec(spec).some((e) => e.field === 'runtime.runtimeType')).toBe(
        false
      );
    }
  });

  it('boundKnowledge 非数组报错', () => {
    const spec = {
      ...defaultAgentDefinitionSpec(),
      boundKnowledge: 'not-array' as unknown as never,
    };
    expect(validateAgentDefinitionSpec(spec).some((e) => e.field === 'boundKnowledge')).toBe(true);
  });

  it('完整 persona 声明通过校验并落 CRD', () => {
    const def = createAgentDefinition({
      tenantId: 'tn',
      name: '客服助手',
      spec: {
        ...defaultAgentDefinitionSpec(),
        persona: {
          systemPrompt: '你是企业客服助手,只回答产品相关问题。',
          guardrails: [
            {
              id: 'g1',
              type: 'keyword',
              pattern: 'api key',
              action: 'block',
              reason: '禁止泄露密钥',
            },
            {
              id: 'g2',
              type: 'regex',
              pattern: '\\b\\d{16,19}\\b',
              action: 'review',
              reason: '疑似卡号',
            },
          ],
          refusalResponse: '抱歉,该请求超出我的处理范围。',
        },
        boundKnowledge: ['kb_finance', 'kb_product'],
        runtime: { runtimeType: 'claude' },
      },
    });
    expect(validateAgentDefinitionSpec(def.spec)).toEqual([]);
    expect(def.spec.persona.guardrails).toHaveLength(2);
    expect(def.spec.runtime.runtimeType).toBe('claude');
  });
});
