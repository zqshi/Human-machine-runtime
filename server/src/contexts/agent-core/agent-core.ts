import type { SessionStore } from './session/session-store.js';
import type { AgentHarness } from './harness/harness.js';
import type { AdapterRegistry } from './sandbox/adapter-registry.js';

/**
 * AgentCore — agent-core 限界上下文的外观 facade。
 *
 * 组合三层:
 *   - session:状态持久化(决策、任务 artifact)
 *   - harness:执行编排(LLM 意图分类、dispatchTask 路由)
 *   - sandbox:Agent 框架适配器注册中心(claude-agent-sdk / openclaw / dify...)
 *
 * AppContext.agentCore 是所有需要 agent 能力的调用方的统一入口。
 * 旧的 ctx.agentRuntimeService / ctx.agentAdapterRegistry 字段保留为兼容 getter,
 * 一个版本后删除(过渡期降低破坏性)。
 */
export class AgentCore {
  constructor(
    public readonly session: SessionStore,
    public readonly harness: AgentHarness,
    public readonly sandbox: AdapterRegistry
  ) {}
}
