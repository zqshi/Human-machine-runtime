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

  constructor(
    llmClient: ILLMClient | null,
    session: SessionStore,
    private readonly sandbox: AdapterRegistry,
    broadcast?: BroadcastFn
  ) {
    this.broadcast =
      broadcast ??
      ((event, data) => {
        appEventBus.publish(event, data as Record<string, unknown>);
      });
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

  /** 测试/关停用:清理 executor 的所有 progress timer。 */
  stop(): void {
    this.executor.stop();
  }
}
