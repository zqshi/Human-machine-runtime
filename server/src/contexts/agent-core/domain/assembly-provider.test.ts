import { describe, it, expect, vi } from 'vitest';
import {
  AssemblyProvider,
  type IInstanceLookupPort,
  type IAgentDefinitionPort,
  type IBoundToolsPort,
  type IContentStorePort,
} from './assembly-provider.js';
import type { AgentDefinition } from './agent-definition.js';

function makeInstanceLookup(defId: string | null): IInstanceLookupPort {
  return { getAgentDefinitionId: vi.fn().mockResolvedValue(defId) };
}

function makeAgentDefPort(def: AgentDefinition | null): IAgentDefinitionPort {
  return { getById: vi.fn().mockResolvedValue(def) };
}

function makeBoundToolsPort(
  rows: Array<{
    id: string;
    name: string;
    enabled: boolean;
    status: string;
    tenantId: string;
    description?: string | null;
    inputSchema?: Record<string, unknown> | null;
  }>
): IBoundToolsPort {
  return {
    findByIds: vi.fn().mockResolvedValue(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        enabled: r.enabled,
        status: r.status,
        tenantId: r.tenantId,
        description: r.description ?? null,
        inputSchema: r.inputSchema ?? null,
      }))
    ),
  };
}

function makeContentPort(
  rows: Array<{
    id: string;
    name: string;
    description: string;
    content: string | null;
    contentRef: string | null;
  }>
): IContentStorePort {
  return { getByIds: vi.fn().mockResolvedValue(rows) };
}

function makeLogger() {
  return { warn: vi.fn() };
}

function makeDef(
  overrides: { boundTools?: string[]; boundSkills?: string[] } = {}
): AgentDefinition {
  return {
    id: 'adef_1',
    tenantId: 'tn_demo',
    name: 'test-def',
    generation: 1,
    spec: {
      sandboxTemplate: 'basic',
      resourceLimits: {
        compute: { cpu: '500m', memory: '512Mi', gpu: null },
        model: { primaryModel: 'auto', fallbackModels: [], maxConcurrency: 5 },
        budget: { monthlyLimitCny: 0, dailyLimitCny: null, alertThresholdPct: 80 },
        storage: { persistentVolumeSize: '2Gi', tempStorageSize: '1Gi' },
        source: 'tenant_default',
        customizedAt: null,
        customizedBy: null,
      },
      workspaceStrategy: { type: 'pvc', size: '2Gi' },
      boundTools: overrides.boundTools ?? [],
      boundSkills: overrides.boundSkills ?? [],
      modelConfig: { primaryModel: 'auto', fallbackModels: [], maxConcurrency: 5 },
    },
    description: null,
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

const REQ = { tenantId: 'tn_demo', instanceId: 'inst-1', prompt: 'hi' };

describe('AssemblyProvider', () => {
  it('instanceLookup/agentDefPort 缺失 → skipped', async () => {
    const svc = new AssemblyProvider(null, null, null, null, makeLogger());
    const r = await svc.assemble(REQ);
    expect(r.skipped).toBe(true);
  });

  it('无 instanceId → skipped', async () => {
    const svc = new AssemblyProvider(
      makeInstanceLookup('adef_1'),
      makeAgentDefPort(makeDef()),
      null,
      null,
      makeLogger()
    );
    const r = await svc.assemble({ tenantId: 'tn', prompt: 'hi' });
    expect(r.skipped).toBe(true);
  });

  it('instance 无 agentDefinitionId → skipped', async () => {
    const svc = new AssemblyProvider(
      makeInstanceLookup(null),
      makeAgentDefPort(makeDef()),
      null,
      null,
      makeLogger()
    );
    const r = await svc.assemble(REQ);
    expect(r.skipped).toBe(true);
  });

  it('AgentDefinition 查不到 → skipped', async () => {
    const svc = new AssemblyProvider(
      makeInstanceLookup('adef_1'),
      makeAgentDefPort(null),
      null,
      null,
      makeLogger()
    );
    const r = await svc.assemble(REQ);
    expect(r.skipped).toBe(true);
  });

  it('boundTools → allowedTools 映射正确(取 name)', async () => {
    const def = makeDef({ boundTools: ['tdef_1', 'tdef_2'] });
    const svc = new AssemblyProvider(
      makeInstanceLookup('adef_1'),
      makeAgentDefPort(def),
      makeBoundToolsPort([
        { id: 'tdef_1', name: 'Bash', enabled: true, status: 'active', tenantId: 'tn_demo' },
        { id: 'tdef_2', name: 'Write', enabled: true, status: 'active', tenantId: 'tn_demo' },
      ]),
      null,
      makeLogger()
    );
    const r = await svc.assemble(REQ);
    expect(r.allowedTools).toEqual(expect.arrayContaining(['Bash', 'Write']));
    expect(r.sources.tools.resolved).toBe(2);
    expect(r.degraded).toBe(false);
  });

  it('externalTools 携带 description/inputSchema 透传给 worker(T18b-A)', async () => {
    const def = makeDef({ boundTools: ['tdef_1'] });
    const svc = new AssemblyProvider(
      makeInstanceLookup('adef_1'),
      makeAgentDefPort(def),
      makeBoundToolsPort([
        {
          id: 'tdef_1',
          name: 'get_weather',
          enabled: true,
          status: 'active',
          tenantId: 'tn_demo',
          description: '查询城市天气',
          inputSchema: { type: 'object', properties: { city: { type: 'string' } } },
        },
      ]),
      null,
      makeLogger()
    );
    const r = await svc.assemble(REQ);
    expect(r.externalTools).toHaveLength(1);
    expect(r.externalTools![0]).toEqual({
      toolId: 'tdef_1',
      name: 'get_weather',
      description: '查询城市天气',
      inputSchema: { type: 'object', properties: { city: { type: 'string' } } },
    });
  });

  it('externalTools description 缺省降级 name,inputSchema 缺省空 schema', async () => {
    const def = makeDef({ boundTools: ['tdef_1'] });
    const svc = new AssemblyProvider(
      makeInstanceLookup('adef_1'),
      makeAgentDefPort(def),
      makeBoundToolsPort([
        { id: 'tdef_1', name: 'noop', enabled: true, status: 'active', tenantId: 'tn_demo' },
      ]),
      null,
      makeLogger()
    );
    const r = await svc.assemble(REQ);
    expect(r.externalTools).toHaveLength(1);
    expect(r.externalTools![0]).toEqual({
      toolId: 'tdef_1',
      name: 'noop',
      description: 'noop',
      inputSchema: {},
    });
  });

  it('跨租户/禁用工具被跳过时 externalTools 同步 undefined', async () => {
    const def = makeDef({ boundTools: ['tdef_1'] });
    const svc = new AssemblyProvider(
      makeInstanceLookup('adef_1'),
      makeAgentDefPort(def),
      makeBoundToolsPort([
        { id: 'tdef_1', name: 'Bash', enabled: true, status: 'active', tenantId: 'tn_other' },
      ]),
      null,
      makeLogger()
    );
    const r = await svc.assemble(REQ);
    expect(r.allowedTools).toBeUndefined();
    expect(r.externalTools).toBeUndefined();
    expect(r.degraded).toBe(true);
  });

  it('boundSkills → skillsContext 拼接(content 优先)', async () => {
    const def = makeDef({ boundSkills: ['sk_1', 'sk_2'] });
    const svc = new AssemblyProvider(
      makeInstanceLookup('adef_1'),
      makeAgentDefPort(def),
      null,
      makeContentPort([
        { id: 'sk_1', name: '报销技能', description: '处理报销', content: '步骤1\n步骤2' },
        { id: 'sk_2', name: '请假技能', description: '处理请假', content: '提交申请' },
      ]),
      makeLogger()
    );
    const r = await svc.assemble(REQ);
    expect(r.skillsContext).toContain('## 报销技能');
    expect(r.skillsContext).toContain('步骤1');
    expect(r.skillsContext).toContain('## 请假技能');
    expect(r.sources.skills.resolved).toBe(2);
  });

  it('工具+skill 并行组装,两者都有', async () => {
    const def = makeDef({ boundTools: ['tdef_1'], boundSkills: ['sk_1'] });
    const svc = new AssemblyProvider(
      makeInstanceLookup('adef_1'),
      makeAgentDefPort(def),
      makeBoundToolsPort([
        { id: 'tdef_1', name: 'Bash', enabled: true, status: 'active', tenantId: 'tn_demo' },
      ]),
      makeContentPort([{ id: 'sk_1', name: 'S', description: 'd', content: 'c' }]),
      makeLogger()
    );
    const r = await svc.assemble(REQ);
    expect(r.allowedTools).toEqual(['Bash']);
    expect(r.skillsContext).toContain('## S');
  });

  it('跨租户工具被跳过(tenantId 不匹配)', async () => {
    const def = makeDef({ boundTools: ['tdef_1'] });
    const svc = new AssemblyProvider(
      makeInstanceLookup('adef_1'),
      makeAgentDefPort(def),
      makeBoundToolsPort([
        { id: 'tdef_1', name: 'Bash', enabled: true, status: 'active', tenantId: 'tn_other' },
      ]),
      null,
      makeLogger()
    );
    const r = await svc.assemble(REQ);
    expect(r.allowedTools).toBeUndefined();
    expect(r.sources.tools.skipped).toBe(1);
  });

  it('禁用工具被跳过(enabled=false)', async () => {
    const def = makeDef({ boundTools: ['tdef_1'] });
    const svc = new AssemblyProvider(
      makeInstanceLookup('adef_1'),
      makeAgentDefPort(def),
      makeBoundToolsPort([
        { id: 'tdef_1', name: 'Bash', enabled: false, status: 'active', tenantId: 'tn_demo' },
      ]),
      null,
      makeLogger()
    );
    const r = await svc.assemble(REQ);
    expect(r.allowedTools).toBeUndefined();
    expect(r.sources.tools.skipped).toBe(1);
  });

  it('空数组陷阱:boundTools 非空但全失效 → undefined + degraded', async () => {
    const def = makeDef({ boundTools: ['tdef_1'] });
    const svc = new AssemblyProvider(
      makeInstanceLookup('adef_1'),
      makeAgentDefPort(def),
      makeBoundToolsPort([]), // 全查不到
      null,
      makeLogger()
    );
    const r = await svc.assemble(REQ);
    expect(r.allowedTools).toBeUndefined(); // 不覆盖,走默认(不静默放开全工具)
    expect(r.degraded).toBe(true);
    expect(r.sources.tools.skipped).toBe(1);
  });

  it('空数组陷阱:boundTools 本就空 → undefined + 不 degraded', async () => {
    const def = makeDef({ boundTools: [] });
    const svc = new AssemblyProvider(
      makeInstanceLookup('adef_1'),
      makeAgentDefPort(def),
      makeBoundToolsPort([]),
      null,
      makeLogger()
    );
    const r = await svc.assemble(REQ);
    expect(r.allowedTools).toBeUndefined();
    expect(r.degraded).toBe(false); // 无绑定不算降级
  });

  it('部分工具有效 + 部分失效 → 只取有效的,不 degraded', async () => {
    const def = makeDef({ boundTools: ['tdef_1', 'tdef_2'] });
    const svc = new AssemblyProvider(
      makeInstanceLookup('adef_1'),
      makeAgentDefPort(def),
      makeBoundToolsPort([
        { id: 'tdef_1', name: 'Bash', enabled: true, status: 'active', tenantId: 'tn_demo' },
      ]), // tdef_2 查不到
      null,
      makeLogger()
    );
    const r = await svc.assemble(REQ);
    expect(r.allowedTools).toEqual(['Bash']);
    expect(r.degraded).toBe(false);
    expect(r.sources.tools.skipped).toBe(1);
  });

  it('allowedTools 去重(重复 definitionId 或同 name)', async () => {
    const def = makeDef({ boundTools: ['tdef_1', 'tdef_2'] });
    const svc = new AssemblyProvider(
      makeInstanceLookup('adef_1'),
      makeAgentDefPort(def),
      makeBoundToolsPort([
        { id: 'tdef_1', name: 'Bash', enabled: true, status: 'active', tenantId: 'tn_demo' },
        { id: 'tdef_2', name: 'Bash', enabled: true, status: 'active', tenantId: 'tn_demo' },
      ]),
      null,
      makeLogger()
    );
    const r = await svc.assemble(REQ);
    expect(r.allowedTools).toEqual(['Bash']);
  });

  it('skill content 为空回退 contentRef(纯文本)', async () => {
    const def = makeDef({ boundSkills: ['sk_1'] });
    const svc = new AssemblyProvider(
      makeInstanceLookup('adef_1'),
      makeAgentDefPort(def),
      null,
      makeContentPort([
        { id: 'sk_1', name: 'S', description: 'd', content: null, contentRef: '历史内容文本' },
      ]),
      makeLogger()
    );
    const r = await svc.assemble(REQ);
    expect(r.skillsContext).toContain('历史内容文本');
  });

  it('skill contentRef 是 url → 跳过(无解析器)', async () => {
    const def = makeDef({ boundSkills: ['sk_1'] });
    const svc = new AssemblyProvider(
      makeInstanceLookup('adef_1'),
      makeAgentDefPort(def),
      null,
      makeContentPort([
        {
          id: 'sk_1',
          name: 'S',
          description: 'd',
          content: null,
          contentRef: 'https://x.com/s.md',
        },
      ]),
      makeLogger()
    );
    const r = await svc.assemble(REQ);
    expect(r.skillsContext).toBeUndefined();
    expect(r.sources.skills.skipped).toBe(1);
  });

  it('instanceLookup 抛错 → 容错 skipped(不阻断)', async () => {
    const svc = new AssemblyProvider(
      { getAgentDefinitionId: vi.fn().mockRejectedValue(new Error('db down')) },
      makeAgentDefPort(makeDef()),
      null,
      null,
      makeLogger()
    );
    const r = await svc.assemble(REQ);
    expect(r.skipped).toBe(true);
  });
});
