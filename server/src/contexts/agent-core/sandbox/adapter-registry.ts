/**
 * AdapterRegistry — sandbox 层的 Agent 框架注册中心。
 *
 * 原 AgentRuntimeAdapterRegistry(在 agent-runtime-adapter.ts 内)的实现,
 * 独立成文件方便 sandbox 模块边界清晰。
 *
 * 职责:
 *   - register/unregister:注册各 Agent 框架适配器(claude-agent-sdk / cockpit / dify...)
 *   - dispatchTask:按 preferredFramework 路由任务到 adapter
 *   - healthCheckAll:统一健康探活
 *
 * 不做业务编排(编排归 harness),仅做 adapter 选择 + 透传。
 */
import type {
  AgentFramework,
  AgentTaskInput,
  AgentTaskStatus,
  IAgentRuntimeAdapter,
} from './agent-runtime-adapter.js';

export class AdapterRegistry {
  private adapters = new Map<AgentFramework, IAgentRuntimeAdapter>();

  register(adapter: IAgentRuntimeAdapter): void {
    this.adapters.set(adapter.framework, adapter);
  }

  unregister(framework: AgentFramework): void {
    this.adapters.delete(framework);
  }

  get(framework: AgentFramework): IAgentRuntimeAdapter | undefined {
    return this.adapters.get(framework);
  }

  listRegistered(): AgentFramework[] {
    return Array.from(this.adapters.keys());
  }

  async dispatchTask(
    task: AgentTaskInput,
    preferredFramework?: AgentFramework
  ): Promise<{ taskId: string; framework: AgentFramework }> {
    const adapter = preferredFramework
      ? this.adapters.get(preferredFramework)
      : this.selectBestAdapter(task);

    if (!adapter) {
      throw new Error(
        preferredFramework
          ? `Agent framework "${preferredFramework}" not registered`
          : 'No agent runtime adapter available'
      );
    }

    const result = await adapter.submitTask(task);
    return { taskId: result.taskId, framework: adapter.framework };
  }

  private selectBestAdapter(_task: AgentTaskInput): IAgentRuntimeAdapter | undefined {
    // 优先 tool-loop(实例任务真执行,不被模型绑定;替代假桩 cockpit 默认路由)
    const toolLoop = this.adapters.get('tool-loop');
    if (toolLoop) return toolLoop;
    const adapters = Array.from(this.adapters.values());
    return adapters[0];
  }

  async healthCheckAll(): Promise<
    Array<{ framework: AgentFramework; healthy: boolean; latencyMs: number }>
  > {
    const results: Array<{ framework: AgentFramework; healthy: boolean; latencyMs: number }> = [];
    for (const adapter of this.adapters.values()) {
      try {
        const health = await adapter.healthCheck();
        results.push({ framework: adapter.framework, ...health });
      } catch {
        results.push({ framework: adapter.framework, healthy: false, latencyMs: -1 });
      }
    }
    return results;
  }

  /**
   * 按 taskId 查任务状态:遍历所有 adapter,返回第一个真正持有该 task 的状态。
   * adapter 找不到任务时返回 failed+"Task not found",跳过继续遍历其他 adapter。
   * 单 adapter 抛错不阻断(继续其他 adapter)。全部 not found → 返回 not found。
   * 用于 dispatch 异步执行后,调用方按 taskId 轮询任务态/结论(getTaskStatus)。
   */
  async getTaskStatus(taskId: string): Promise<AgentTaskStatus> {
    for (const adapter of this.adapters.values()) {
      try {
        const status = await adapter.getTaskStatus(taskId);
        if (!(status.state === 'failed' && /not found/i.test(status.error ?? ''))) {
          return status;
        }
      } catch {
        // 单 adapter 查询异常不阻断,继续遍历其他 adapter
      }
    }
    return {
      taskId,
      state: 'failed',
      progress: 0,
      error: 'Task not found',
      lastUpdatedAt: new Date(),
    };
  }
}

// 向后兼容:旧 import 路径 `../domain/agent-runtime-adapter.js` 引用的
// AgentRuntimeAdapterRegistry 仍可用,作为 alias 指向 AdapterRegistry。
// bootstrap 等老代码迁移后,此 export 可删除。
export { AdapterRegistry as AgentRuntimeAdapterRegistry };
