import { describe, it, expect, vi } from 'vitest';
import {
  buildAgentDefinitionSpec,
  createOrUpdateAgentDefinition,
  instantiateAgentDefinition,
  type AgentCreateFormDraft,
  type AgentDefinitionUseCaseDeps,
} from './agentDefinitionUseCase';
import type { AgentDefinition, AgentDefinitionSpec } from '../services/adminApi';

function mockDeps(overrides: Partial<AgentDefinitionUseCaseDeps> = {}): AgentDefinitionUseCaseDeps {
  return {
    agentDefinitionApi: {
      create: vi.fn(),
      update: vi.fn(),
      instantiate: vi.fn(),
      ...overrides.agentDefinitionApi,
    } as never,
  };
}

const baseForm: AgentCreateFormDraft = {
  sandboxTemplate: 'basic',
  primaryModel: 'auto',
  fallbackModels: [],
  maxConcurrency: 5,
  systemPrompt: '你是助手',
  guardrails: [],
  refusalResponse: '',
  boundSkills: [],
  boundKnowledge: [],
  boundTools: [],
  runtimeType: 'claude',
};

describe('buildAgentDefinitionSpec', () => {
  it('表单字段映射到 spec(含 default 兜底)', () => {
    const spec = buildAgentDefinitionSpec(baseForm);
    expect(spec.sandboxTemplate).toBe('basic');
    expect(spec.modelConfig).toEqual({ primaryModel: 'auto', fallbackModels: [], maxConcurrency: 5 });
    expect(spec.persona.systemPrompt).toBe('你是助手');
    expect(spec.runtime).toEqual({ runtimeType: 'claude' });
  });

  it('primaryModel 空白 → 兜底 auto', () => {
    const spec = buildAgentDefinitionSpec({ ...baseForm, primaryModel: '   ' });
    expect(spec.modelConfig.primaryModel).toBe('auto');
  });

  it('空 pattern guardrail 被过滤', () => {
    const spec = buildAgentDefinitionSpec({
      ...baseForm,
      guardrails: [
        { id: 'g1', type: 'keyword', pattern: '敏感词', action: 'block', reason: '' },
        { id: 'g2', type: 'keyword', pattern: '   ', action: 'block', reason: '' },
      ],
    });
    expect(spec.persona.guardrails).toHaveLength(1);
    expect(spec.persona.guardrails[0].id).toBe('g1');
  });
});

describe('createOrUpdateAgentDefinition', () => {
  const fakeDef: AgentDefinition = {
    id: 'adef_1',
    name: '测试',
    generation: 1,
  } as never;

  it('无 definitionId → 走 create(传 tenantId)', async () => {
    const create = vi.fn().mockResolvedValue(fakeDef);
    const deps = mockDeps({ agentDefinitionApi: { create, update: vi.fn(), instantiate: vi.fn() } as never });
    const spec: AgentDefinitionSpec = {} as never;
    const result = await createOrUpdateAgentDefinition(
      { definitionId: undefined, tenantId: 't1', name: '测试', description: 'desc', spec },
      deps
    );
    expect(create).toHaveBeenCalledWith({ tenantId: 't1', name: '测试', spec, description: 'desc' });
    expect(result).toBe(fakeDef);
  });

  it('有 definitionId → 走 update(不传 tenantId)', async () => {
    const update = vi.fn().mockResolvedValue(fakeDef);
    const deps = mockDeps({ agentDefinitionApi: { create: vi.fn(), update, instantiate: vi.fn() } as never });
    const spec: AgentDefinitionSpec = {} as never;
    const result = await createOrUpdateAgentDefinition(
      { definitionId: 'adef_x', tenantId: 'ignored', name: 'n', description: '', spec },
      deps
    );
    expect(update).toHaveBeenCalledWith('adef_x', spec);
    expect(result).toBe(fakeDef);
  });

  it('description 空 → create 传 null', async () => {
    const create = vi.fn().mockResolvedValue(fakeDef);
    const deps = mockDeps({ agentDefinitionApi: { create, update: vi.fn(), instantiate: vi.fn() } as never });
    await createOrUpdateAgentDefinition(
      { tenantId: 't1', name: 'n', description: '', spec: {} as never },
      deps
    );
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ description: null }));
  });
});

describe('instantiateAgentDefinition', () => {
  it('调 agentDefinitionApi.instantiate 返回 {instanceId, name}', async () => {
    const instantiate = vi.fn().mockResolvedValue({ instanceId: 'inst_1', name: '对话' });
    const deps = mockDeps({ agentDefinitionApi: { create: vi.fn(), update: vi.fn(), instantiate } as never });
    const result = await instantiateAgentDefinition('adef_1', deps);
    expect(instantiate).toHaveBeenCalledWith('adef_1');
    expect(result).toEqual({ instanceId: 'inst_1', name: '对话' });
  });
});
