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
import type {
  IAssemblyProvider,
  AssemblyRequest,
} from '../domain/assembly-provider.js';
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
          const rag = await this.ragProvider.getRagContext(recallReq);
          if (rag.context) {
            input.ragContext = rag.context;
            task.input = input;
          }
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
      const instanceId = typeof input.instanceId === 'string' ? input.instanceId : undefined;
      const asmReq: AssemblyRequest = {
        tenantId: task.tenantId,
        instanceId,
        prompt: typeof input.prompt === 'string' ? input.prompt : task.description,
      };
      try {
        const asm = await this.assemblyProvider.assemble(asmReq);
        if (asm.allowedTools !== undefined && input.allowedTools === undefined) {
          input.allowedTools = asm.allowedTools;
        }
        if (asm.skillsContext && input.skillsContext === undefined) {
          input.skillsContext = asm.skillsContext;
        }
        if (asm.allowedTools !== undefined || asm.skillsContext) {
          task.input = input;
        }
        if (asm.degraded) {
          appEventBus.publish('harness:assembly:degraded', {
            taskId: task.id,
            sources: asm.sources,
          });
        }
      } catch (err) {
        appEventBus.publish('harness:assembly:failed', {
          taskId: task.id,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    appEventBus.publish('sandbox:task:dispatched', {
      taskId: task.id,
      tenantId: task.tenantId,
      name: task.name,
      preferredFramework,
    });
    const result = await this.sandbox.dispatchTask(task, preferredFramework);
    return result;
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

  /** 测试/关停用:清理 executor 的所有 progress timer。 */
  stop(): void {
    this.executor.stop();
  }
}
