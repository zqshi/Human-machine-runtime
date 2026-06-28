import { describe, it, expect, vi } from 'vitest';
import { AgentHarness } from './harness.js';
import type { AdapterRegistry } from '../sandbox/adapter-adapter-registry-shim.js';
import type { IAssemblyProvider } from '../domain/assembly-provider.js';
import type { IRuntimeManifestPort } from '../domain/runtime-manifest-port.js';
import type { RuntimeManifest } from '../domain/runtime-manifest.js';
import type { GuardrailRule } from '../domain/agent-definition.js';
import type { AgentTaskInput } from '../sandbox/agent-runtime-adapter.js';

/**
 * AgentHarness - 编译固化路径(v2.0 C6 灰度)测试。
 * 验证:manifest 命中走固化(跳过 assemble)/ 降级老路径 / guardrail 拦截 / 灰度并存。
 */

function makeSessionStub() {
  return { taskArtifactStore: { set: vi.fn(), get: vi.fn() } };
}

function makeSandboxStub(captured: { task: AgentTaskInput | null }) {
  return {
    dispatchTask: vi.fn(async (task: AgentTaskInput) => {
      captured.task = task;
      return { taskId: task.id, framework: 'tool-loop' as const };
    }),
    get: vi.fn(),
  } as unknown as AdapterRegistry;
}

function makeTask(overrides: Partial<AgentTaskInput> = {}): AgentTaskInput {
  return {
    id: 'task-1',
    tenantId: 'tn_demo',
    name: 'do-work',
    description: 'desc',
    priority: 'normal',
    input: { instanceId: 'inst-1', prompt: 'hi' },
    ...overrides,
  };
}

function makeManifest(overrides: Partial<RuntimeManifest> = {}): RuntimeManifest {
  return {
    id: 'rman_1',
    agentDefinitionId: 'adef_1',
    generation: 1,
    bakedAt: 1782570725921,
    status: 'baked',
    compiledSystemPrompt: '你是固化助手',
    compiledGuardrails: [],
    compiledTools: [
      { toolId: 't1', name: 'get_weather', description: '查天气', inputSchema: { type: 'object' } },
    ],
    compiledSkillsContext: '## 技能1\n步骤',
    compiledQuota: {},
    refusalResponse: '超出范围',
    runtimeRoute: 'tool-loop',
    sandboxStrategy: 'opensandbox',
    errorMsg: null,
    ...overrides,
  } as RuntimeManifest;
}

describe('AgentHarness - 编译固化路径(v2.0 C6)', () => {
  it('manifest 命中 → 用固化产物,跳过 assemble', async () => {
    const captured = { task: null };
    const harness = new AgentHarness(null, makeSessionStub() as never, makeSandboxStub(captured));
    const assembleSpy = vi.fn();
    harness.setAssemblyProvider({ assemble: assembleSpy } as unknown as IAssemblyProvider);
    const manifestPort: IRuntimeManifestPort = {
      getManifest: vi.fn().mockResolvedValue(makeManifest()),
    };
    harness.setRuntimeManifestPort(manifestPort);

    await harness.dispatchTask(makeTask());

    // 固化产物注入 input
    expect(captured.task!.input.systemPrompt).toBe('你是固化助手');
    expect(captured.task!.input.allowedTools).toEqual(['get_weather']);
    expect(captured.task!.input.externalTools).toHaveLength(1);
    expect(captured.task!.input.skillsContext).toBe('## 技能1\n步骤');
    // 跳过 assemble(不调)
    expect(assembleSpy).not.toHaveBeenCalled();
  });

  it('无 baked manifest → 降级走 assemble 老路径', async () => {
    const captured = { task: null };
    const harness = new AgentHarness(null, makeSessionStub() as never, makeSandboxStub(captured));
    const assembleSpy = vi.fn().mockResolvedValue({
      allowedTools: ['Bash'],
      sources: { tools: { bound: 1, resolved: 1, skipped: 0 }, skills: { bound: 0, resolved: 0, skipped: 0 } },
      skipped: false,
      degraded: false,
    });
    harness.setAssemblyProvider({ assemble: assembleSpy } as unknown as IAssemblyProvider);
    const manifestPort: IRuntimeManifestPort = {
      getManifest: vi.fn().mockResolvedValue(null), // 无 baked manifest
    };
    harness.setRuntimeManifestPort(manifestPort);

    await harness.dispatchTask(makeTask());

    // 降级:调 assemble
    expect(assembleSpy).toHaveBeenCalledTimes(1);
    expect(captured.task!.input.allowedTools).toEqual(['Bash']);
  });

  it('runtimeManifestPort 未配置 → 走 assemble 老路径(灰度兼容存量)', async () => {
    const captured = { task: null };
    const harness = new AgentHarness(null, makeSessionStub() as never, makeSandboxStub(captured));
    const assembleSpy = vi.fn().mockResolvedValue({
      allowedTools: ['Read'],
      sources: { tools: { bound: 1, resolved: 1, skipped: 0 }, skills: { bound: 0, resolved: 0, skipped: 0 } },
      skipped: false,
      degraded: false,
    });
    harness.setAssemblyProvider({ assemble: assembleSpy } as unknown as IAssemblyProvider);
    // 不 setRuntimeManifestPort(未配置)

    await harness.dispatchTask(makeTask());

    expect(assembleSpy).toHaveBeenCalledTimes(1);
  });

  it('manifest 命中 + guardrails 命中 block → 抛 GUARDRAIL_BLOCKED', async () => {
    const harness = new AgentHarness(null, makeSessionStub() as never, makeSandboxStub({ task: null }));
    const blockRule: GuardrailRule = {
      id: 'gr1',
      type: 'keyword' as never,
      pattern: '机密',
      action: 'block' as never,
      reason: '敏感词',
    };
    const manifestPort: IRuntimeManifestPort = {
      getManifest: vi.fn().mockResolvedValue(
        makeManifest({ compiledGuardrails: [blockRule], refusalResponse: '不能回答机密' })
      ),
    };
    harness.setRuntimeManifestPort(manifestPort);

    await expect(
      harness.dispatchTask(makeTask({ input: { instanceId: 'inst-1', prompt: '这是机密信息' } }))
    ).rejects.toMatchObject({ code: 'GUARDRAIL_BLOCKED' });
  });

  it('调用方已显式传 allowedTools → manifest 不覆盖(与 assemble 一致语义)', async () => {
    const captured = { task: null };
    const harness = new AgentHarness(null, makeSessionStub() as never, makeSandboxStub(captured));
    const manifestPort: IRuntimeManifestPort = {
      getManifest: vi.fn().mockResolvedValue(makeManifest()),
    };
    harness.setRuntimeManifestPort(manifestPort);

    await harness.dispatchTask(makeTask({ input: { instanceId: 'inst-1', allowedTools: ['Custom'] } }));

    // 显式传的不被覆盖
    expect(captured.task!.input.allowedTools).toEqual(['Custom']);
  });
});
