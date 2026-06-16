/**
 * IntentProtocol — 意图类型注册表
 *
 * 定义 Agent 间通信的意图格式。
 * 每个 Agent 发布可接收的 intent 类型（capability declaration），
 * 请求方按类型发出 intent，由 IntentRouter 匹配路由。
 */

export type IntentStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'expired';

export interface IntentDescriptor {
  readonly type: string;
  readonly description: string;
  readonly requiredParams: readonly string[];
  readonly optionalParams: readonly string[];
  readonly expectedOutputType: string;
  readonly maxLatencyMs: number;
}

export interface IntentRegistration {
  readonly agentId: string;
  readonly intents: readonly IntentDescriptor[];
  readonly registeredAt: number;
}

export interface IntentMessage {
  readonly id: string;
  readonly type: string;
  readonly fromAgentId: string;
  readonly toAgentId: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly priority: 'critical' | 'high' | 'normal' | 'low';
  readonly status: IntentStatus;
  readonly createdAt: number;
  readonly respondedAt?: number;
  readonly result?: unknown;
  readonly error?: string;
}

export interface IntentMessageProps {
  id: string;
  type: string;
  fromAgentId: string;
  toAgentId: string;
  params: Record<string, unknown>;
  priority: 'critical' | 'high' | 'normal' | 'low';
  status: IntentStatus;
  createdAt: number;
  respondedAt?: number;
  result?: unknown;
  error?: string;
}

export class IntentProtocol {
  private readonly registry: Map<string, IntentRegistration> = new Map();

  register(agentId: string, intents: IntentDescriptor[]): IntentRegistration {
    const registration: IntentRegistration = {
      agentId,
      intents,
      registeredAt: Date.now(),
    };
    this.registry.set(agentId, registration);
    return registration;
  }

  unregister(agentId: string): boolean {
    return this.registry.delete(agentId);
  }

  getRegistration(agentId: string): IntentRegistration | undefined {
    return this.registry.get(agentId);
  }

  getAllRegistrations(): IntentRegistration[] {
    return Array.from(this.registry.values());
  }

  findHandlers(intentType: string): IntentRegistration[] {
    return Array.from(this.registry.values()).filter((reg) =>
      reg.intents.some((i) => i.type === intentType)
    );
  }

  getDescriptor(agentId: string, intentType: string): IntentDescriptor | undefined {
    const reg = this.registry.get(agentId);
    if (!reg) return undefined;
    return reg.intents.find((i) => i.type === intentType);
  }

  get registeredAgentCount(): number {
    return this.registry.size;
  }

  get totalIntentTypes(): number {
    const types = new Set<string>();
    for (const reg of this.registry.values()) {
      for (const intent of reg.intents) {
        types.add(intent.type);
      }
    }
    return types.size;
  }

  static createMessage(
    props: Omit<IntentMessageProps, 'id' | 'status' | 'createdAt'>
  ): IntentMessage {
    return {
      ...props,
      id: `intent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      status: 'pending',
      createdAt: Date.now(),
    };
  }

  static completeMessage(msg: IntentMessage, result: unknown): IntentMessage {
    return { ...msg, status: 'completed', respondedAt: Date.now(), result };
  }

  static rejectMessage(msg: IntentMessage, error: string): IntentMessage {
    return { ...msg, status: 'rejected', respondedAt: Date.now(), error };
  }

  static expireMessage(msg: IntentMessage): IntentMessage {
    return { ...msg, status: 'expired', respondedAt: Date.now() };
  }
}
