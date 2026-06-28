import { describe, it, expect } from 'vitest';
import {
  sealManifest,
  canTransition,
  type ManifestDraft,
  type ManifestStatus,
} from './runtime-manifest.js';
import type { GuardrailRule } from './agent-definition.js';

function makeDraft(overrides: Partial<ManifestDraft> = {}): ManifestDraft {
  return {
    id: 'rman_test',
    agentDefinitionId: 'adef_1',
    generation: 1,
    bakedAt: 1782570725921,
    status: 'pending',
    compiledSystemPrompt: '你是助手',
    compiledGuardrails: [
      { id: 'gr1', type: 'keyword' as never, pattern: '机密', action: 'block' as never, reason: '敏感词' },
    ] as GuardrailRule[],
    compiledTools: [
      {
        toolId: 't1',
        name: 'get_weather',
        description: '查天气',
        inputSchema: { type: 'object' },
      },
    ],
    compiledSkillsContext: '## skill1\n内容',
    compiledQuota: { maxInstances: 10 },
    refusalResponse: '超出范围',
    runtimeRoute: 'tool-loop',
    sandboxStrategy: 'opensandbox',
    errorMsg: null,
    ...overrides,
  };
}

describe('sealManifest', () => {
  it('冻结后顶层字段不可写(strict 模式抛错)', () => {
    const sealed = sealManifest(makeDraft({ status: 'baked' }));
    expect(() => {
      (sealed as ManifestDraft).compiledSystemPrompt = '篡改';
    }).toThrow(TypeError);
  });

  it('冻结 compiledTools 嵌套对象不可写', () => {
    const sealed = sealManifest(makeDraft({ status: 'baked' }));
    expect(() => {
      sealed.compiledTools[0].name = '篡改工具名';
    }).toThrow(TypeError);
  });

  it('冻结 compiledGuardrails 嵌套对象不可写', () => {
    const sealed = sealManifest(makeDraft({ status: 'baked' }));
    expect(() => {
      sealed.compiledGuardrails[0].reason = '篡改原因';
    }).toThrow(TypeError);
  });

  it('冻结 compiledQuota 嵌套对象不可写', () => {
    const sealed = sealManifest(makeDraft({ status: 'baked' }));
    expect(() => {
      (sealed.compiledQuota as { maxInstances: number }).maxInstances = 999;
    }).toThrow(TypeError);
  });

  it('返回原引用(freeze 原地冻结)', () => {
    const draft = makeDraft({ status: 'baked' });
    const sealed = sealManifest(draft);
    expect(sealed).toBe(draft as unknown as typeof sealed);
  });

  it('保留所有固化字段值', () => {
    const draft = makeDraft({ status: 'baked' });
    const sealed = sealManifest(draft);
    expect(sealed.id).toBe('rman_test');
    expect(sealed.compiledSystemPrompt).toBe('你是助手');
    expect(sealed.compiledTools).toHaveLength(1);
    expect(sealed.compiledGuardrails[0].pattern).toBe('机密');
    expect(sealed.runtimeRoute).toBe('tool-loop');
    expect(sealed.sandboxStrategy).toBe('opensandbox');
  });
});

describe('canTransition', () => {
  it('pending → baked 合法', () => {
    expect(canTransition('pending', 'baked')).toBe(true);
  });

  it('pending → failed 合法', () => {
    expect(canTransition('pending', 'failed')).toBe(true);
  });

  it('baked → expired 合法', () => {
    expect(canTransition('baked', 'expired')).toBe(true);
  });

  it('baked → pending 非法(已固化不可回退重 bake)', () => {
    expect(canTransition('baked', 'pending')).toBe(false);
  });

  it('failed → pending 合法(失败可重试)', () => {
    expect(canTransition('failed', 'pending')).toBe(true);
  });

  it('baked → failed 非法(已固化不可标记失败)', () => {
    expect(canTransition('baked', 'failed')).toBe(false);
  });

  it('expired → 任意 非法(终态)', () => {
    const statuses: ManifestStatus[] = ['pending', 'baked', 'failed', 'expired'];
    for (const s of statuses) {
      expect(canTransition('expired', s)).toBe(false);
    }
  });
});
