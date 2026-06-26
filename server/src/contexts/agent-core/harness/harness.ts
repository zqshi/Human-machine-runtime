import {
  AgentExecutor,
  type AgentExecutorStores,
  type ILLMClient,
  type BroadcastFn,
} from '../domain/agent-executor.js';
import type { SessionStore } from '../session/session-store.js';
import type { AdapterRegistry } from '../sandbox/adapter-registry.js';
import type {
  AgentTaskInput,
  AgentFramework,
  AgentTaskResult,
} from '../sandbox/agent-runtime-adapter.js';
import type { IRagContextProvider, RagRecallRequest } from '../domain/rag-context-provider.js';
import type { IAssemblyProvider, AssemblyRequest } from '../domain/assembly-provider.js';
import type { IPersonaProvider, PersonaResult } from '../domain/persona-provider.js';
import { checkGuardrails } from '../domain/guardrail-checker.js';
import type { ITraceRecorder } from '../domain/trace-recorder.js';
import { newId, AppError } from '../../../shared/utils.js';
import type { IToolRegistry } from '../../tool-management/tool-registry.js';
import { appEventBus } from '../../../shared/event-bus.js';

/**
 * AgentHarness — agent-core 的编排层。
 *
 * 职责:
 *   - execute:委托 AgentExecutor 做 LLM 意图分类 + Artifact 创建
 *   - dispatchTask:把 AgentTaskInput 路由到 sandbox 的 adapter(通过 AdapterRegistry)
 *   - setToolRegistry:工具调用兜底链路激活
 *
 * Session 层(SessionStore)负责状态持久化;Sandbox 层(AdapterRegistry)负责执行。
 * Harness 在中间编排:接调用方请求 → 执行意图分类 → 路由执行 → 结果回写 Session。
 *
 * 注:D3 阶段 Harness 只做"组装",execute 内部仍调原 AgentExecutor。
 * 真正把 execute 内联到 harness 留待 AgentExecutor 删除(D6,不在本次范围)。
 */
export class AgentHarness {
  private readonly executor: AgentExecutor;
  private readonly broadcast: BroadcastFn;
  private ragProvider: IRagContextProvider | null;
  private assemblyProvider: IAssemblyProvider | null;
  private personaProvider: IPersonaProvider | null;
  private traceRecorder: ITraceRecorder | null;

  constructor(
    llmClient: ILLMClient | null,
    session: SessionStore,
    private readonly sandbox: AdapterRegistry,
    broadcast?: BroadcastFn,
    ragProvider?: IRagContextProvider | null
  ) {
    this.broadcast =
      broadcast ??
      ((event, data) => {
        appEventBus.publish(event, data as Record<string, unknown>);
      });
    this.ragProvider = ragProvider ?? null;
    this.assemblyProvider = null;
    this.personaProvider = null;
    this.traceRecorder = null;
    const execStores: AgentExecutorStores = { tasks: session.taskArtifactStore };
    this.executor = new AgentExecutor(llmClient, execStores, this.broadcast);
  }

  async execute(userText: string, responseText: string, sessionId: string, tenantId?: string) {
    appEventBus.publish('harness:execute:started', {
      sessionId,
      tenantId,
      userTextLength: userText.length,
    });
    const result = await this.executor.execute(userText, responseText, sessionId, tenantId);
    appEventBus.publish('harness:execute:completed', {
      sessionId,
      intent: result.intent,
      artifactId: result.artifactId,
    });
    return result;
  }

  async dispatchTask(
    task: AgentTaskInput,
    preferredFramework?: AgentFramework
  ): Promise<{ taskId: string; framework: AgentFramework }> {
    // v1.6:全链路 trace。入口生成 traceId(复用 input.traceId 或新建)+ 写根 trace;
    // 三段(RAG/assembly/sandbox)各开 child span(扁平挂根 parentSpanId=undefined);
    // 完成收尾 updateDistributedTrace。trace 失败不阻断主链路。
    const input0 = (task.input ?? {}) as Record<string, unknown>;
    const traceId = typeof input0.traceId === 'string' ? input0.traceId : newId('trc');
    // 把 traceId 写回 input(若原无),让 adapter/worker payload 能透传(协议预留)
    if (input0.traceId === undefined) {
      input0.traceId = traceId;
      task.input = input0;
    }
    const traceStartTime = Date.now();
    const spanCount = { value: 0 };
    const traceRecorder = this.traceRecorder;
    const instanceId = typeof input0.instanceId === 'string' ? input0.instanceId : undefined;
    const sessionId = typeof input0.sessionId === 'string' ? input0.sessionId : undefined;

    // 内联 span 记录 helper:记 startTime→fn→insertSpan(扁平挂根)。
    // fn 抛错仍写 span(status=error)再 rethrow(由外层 try/catch 容错)。
    const traceStep = async <T>(
      operationName: string,
      spanKind: 'internal' | 'client' | 'server',
      fn: () => Promise<T>
    ): Promise<T> => {
      if (!traceRecorder) return fn();
      const startTime = new Date();
      let status = 'ok';
      try {
        return await fn();
      } catch (err) {
        status = 'error';
        throw err;
      } finally {
        spanCount.value++;
        try {
          await traceRecorder.insertSpan({
            spanId: newId('spn'),
            distTraceId: traceId,
            parentSpanId: undefined, // 扁平挂根
            operationName,
            spanKind,
            startTime,
            latencyMs: Date.now() - startTime.getTime(),
            status,
            metadata: { taskId: task.id },
          });
        } catch {
          // span 写入失败不阻断(trace 是旁路观测)
        }
      }
    };

    if (traceRecorder) {
      try {
        await traceRecorder.insertDistributedTrace({
          traceId,
          rootOperation: 'agent.task',
          instanceId,
          sessionId,
          tags: { taskId: task.id, name: task.name },
        });
      } catch {
        // 根 trace 写失败不阻断
      }
    }

    // D2:执行前召回 RAG 上下文(知识库 + 员工记忆),注入到 task.input.ragContext。
    // provider 缺省或召回跳过(skipped)则不改 task,主链路不受影响。
    if (this.ragProvider) {
      const input = (task.input ?? {}) as Record<string, unknown>;
      // 已显式传入 ragContext 则不覆盖(调用方优先)
      if (input.ragContext === undefined) {
        const recallReq: RagRecallRequest = {
          tenantId: task.tenantId,
          instanceId: typeof input.instanceId === 'string' ? input.instanceId : undefined,
          prompt: typeof input.prompt === 'string' ? input.prompt : task.description,
        };
        try {
          await traceStep('rag.retrieve', 'internal', async () => {
            const rag = await this.ragProvider!.getRagContext(recallReq);
            if (rag.context) {
              input.ragContext = rag.context;
              task.input = input;
            }
          });
        } catch (err) {
          // 召回失败不阻断主链路(provider 内部已容错,此处双保险)
          appEventBus.publish('harness:rag:failed', {
            taskId: task.id,
            err: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    // v1.4:组装层(按 Agent 定义自动组装 allowedTools + skillsContext)。
    // 调用方优先(已显式传 allowedTools/skillsContext 则不覆盖)。assemble 内部容错,失败不阻断。
    if (this.assemblyProvider) {
      const input = (task.input ?? {}) as Record<string, unknown>;
      const asmInstanceId = typeof input.instanceId === 'string' ? input.instanceId : undefined;
      const asmReq: AssemblyRequest = {
        tenantId: task.tenantId,
        instanceId: asmInstanceId,
        prompt: typeof input.prompt === 'string' ? input.prompt : task.description,
      };
      try {
        await traceStep('assembly.compose', 'internal', async () => {
          const asm = await this.assemblyProvider!.assemble(asmReq);
          if (asm.allowedTools !== undefined && input.allowedTools === undefined) {
            input.allowedTools = asm.allowedTools;
          }
          // T18b-A:透传 externalTools 给 worker 路径(claude-agent-sdk adapter),让 boundTools
          // 注册为 SDK custom tool 并回调 server /tool-invoke 收口(审批/凭证/计费/日志生效)。
          if (asm.externalTools && input.externalTools === undefined) {
            input.externalTools = asm.externalTools;
          }
          if (asm.skillsContext && input.skillsContext === undefined) {
            input.skillsContext = asm.skillsContext;
          }
          if (asm.allowedTools !== undefined || asm.externalTools || asm.skillsContext) {
            task.input = input;
          }
          if (asm.degraded) {
            appEventBus.publish('harness:assembly:degraded', {
              taskId: task.id,
              sources: asm.sources,
            });
          }
        });
      } catch (err) {
        appEventBus.publish('harness:assembly:failed', {
          taskId: task.id,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // v1.9:persona 注入 + guardrail 拦截(#1)。provider 缺省或无 persona 则不改 task(兼容旧实例)。
    // block 命中 → 抛 GUARDRAIL_BLOCKED(含 refusalResponse),不 dispatch;调用方 catch 返回拒答。
    if (this.personaProvider && instanceId) {
      const persona = await traceStep<PersonaResult | null>(
        'persona.recall',
        'internal',
        async () => {
          const p = await this.personaProvider!.getPersona(instanceId);
          if (p.hasPersona && p.systemPrompt && input0.systemPrompt === undefined) {
            input0.systemPrompt = p.systemPrompt;
            task.input = input0;
          }
          return p;
        }
      ).catch((err) => {
        appEventBus.publish('harness:persona:failed', {
          taskId: task.id,
          err: err instanceof Error ? err.message : String(err),
        });
        return null;
      });
      // guardrail 检查(纯逻辑,同步,不阻断 trace)。block 直接拒答;review 暂标记留后续 LLM 复核。
      if (persona?.hasPersona && persona.guardrails.length > 0) {
        const promptText = typeof input0.prompt === 'string' ? input0.prompt : task.description;
        const guardResult = checkGuardrails(promptText, persona.guardrails);
        if (guardResult.blocked) {
          appEventBus.publish('harness:guardrail:blocked', {
            taskId: task.id,
            tenantId: task.tenantId,
            ruleId: guardResult.matchedRule?.id,
          });
          throw new AppError(
            persona.refusalResponse || '该请求超出我的处理范围。',
            403,
            'GUARDRAIL_BLOCKED'
          );
        }
      }
    }

    appEventBus.publish('sandbox:task:dispatched', {
      taskId: task.id,
      tenantId: task.tenantId,
      name: task.name,
      preferredFramework,
      traceId,
    });
    try {
      const result = await traceStep('sandbox.dispatch', 'client', () =>
        this.sandbox.dispatchTask(task, preferredFramework)
      );
      return result;
    } finally {
      // v1.6:根 trace 收尾(含 spanCount + 总耗时)
      if (traceRecorder) {
        try {
          await traceRecorder.updateDistributedTrace(traceId, {
            status: 'completed',
            spanCount: spanCount.value,
            totalDurationMs: Date.now() - traceStartTime,
            completedAt: new Date(),
          });
        } catch {
          // 收尾失败不阻断
        }
      }
    }
  }

  /** Adapter 任务完成回调注册(透传 sandbox.adapterRegistry 的任意 adapter)。 */
  onTaskComplete(
    framework: AgentFramework,
    callback: (result: AgentTaskResult) => void
  ): () => void {
    const adapter = this.sandbox.get(framework);
    if (!adapter) {
      throw new Error(`Agent framework "${framework}" not registered`);
    }
    return adapter.onTaskComplete(callback);
  }

  /** 注入工具注册中心,激活 Agent 工具调用兜底。 */
  setToolRegistry(registry: IToolRegistry): void {
    this.executor.setToolRegistry(registry);
  }

  /**
   * 注入 RAG 上下文召回器,激活 dispatchTask 前的知识库/记忆召回(D2)。
   * 延后注入:knowledgeService/memoryService 在 bootstrap 中晚于 AgentHarness 实例化,
   * 故用 setter(模式同 setToolRegistry)而非构造注入。
   */
  setRagProvider(provider: IRagContextProvider | null): void {
    this.ragProvider = provider;
  }

  /**
   * 注入组装层,激活 dispatchTask 前的 allowedTools + skillsContext 自动组装(v1.4)。
   * 延后注入(模式同 setRagProvider):依赖 repo 晚于 AgentHarness 实例化。
   */
  setAssemblyProvider(provider: IAssemblyProvider | null): void {
    this.assemblyProvider = provider;
  }

  /**
   * 注入 PersonaProvider,激活 dispatchTask 前的人设注入 + guardrail 拦截(v1.9,#1)。
   * 延后注入(模式同 setRagProvider/setAssemblyProvider)。
   */
  setPersonaProvider(provider: IPersonaProvider | null): void {
    this.personaProvider = provider;
  }

  /**
   * 注入 trace 记录器,激活 dispatchTask 全链路 trace 串联(v1.6)。
   * 延后注入(模式同 setRagProvider/setAssemblyProvider)。
   */
  setTraceRecorder(recorder: ITraceRecorder | null): void {
    this.traceRecorder = recorder;
  }

  /** 测试/关停用:清理 executor 的所有 progress timer。 */
  stop(): void {
    this.executor.stop();
  }
}
