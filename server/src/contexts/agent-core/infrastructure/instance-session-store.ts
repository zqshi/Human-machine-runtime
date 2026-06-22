import type { Database } from '../../../db/client.js';
import { DbMapStore } from '../../../db/repositories/agent-runtime-repository.js';

/**
 * Agent SDK sessionId ↔ 数字员工实例(instanceId)的持久化映射。
 *
 * 用途:ClaudeAgentSdkAdapter 在每个 submitTask 前查询 instanceId 是否已有
 * sessionId,若有则 `resume` 到 Agent SDK 的 query(),实现跨任务上下文保留。
 *
 * 存储:复用 openclaw_entities 表(entityType='agent_instance_session'),
 * 与 agent_decision / agent_task 等共享 JSONB 存储,无 migration。
 *
 * TTL:24 小时无活动后失效,避免累积陈旧上下文。
 */

export interface InstanceSessionRecord {
  sessionId: string;
  updatedAt: number;
}

export interface InstanceSessionStore {
  getSessionId(instanceId: string): Promise<string | undefined>;
  setSessionId(instanceId: string, sessionId: string): Promise<void>;
  deleteSessionId(instanceId: string): Promise<void>;
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export class DbInstanceSessionStore implements InstanceSessionStore {
  private store: DbMapStore<InstanceSessionRecord>;

  constructor(db: Database) {
    this.store = new DbMapStore<InstanceSessionRecord>(db, 'agent_instance_session');
  }

  async getSessionId(instanceId: string): Promise<string | undefined> {
    await this.store.load();
    const record = this.store.get(instanceId);
    if (!record) return undefined;
    if (Date.now() - record.updatedAt > SESSION_TTL_MS) {
      await this.store.delete(instanceId);
      return undefined;
    }
    return record.sessionId;
  }

  async setSessionId(instanceId: string, sessionId: string): Promise<void> {
    this.store.set(instanceId, { sessionId, updatedAt: Date.now() });
  }

  async deleteSessionId(instanceId: string): Promise<void> {
    await this.store.delete(instanceId);
  }
}
