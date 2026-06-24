/**
 * 工具管理(Tool Management)依赖组装。
 *
 * 从 `bootstrap.ts` 拆出:ToolManagementService(CRUD + 凭证解锁)+ ToolRegistryService(
 * 执行 + 健康检查 + advisory lock 并发兜底)。激活后向 agentHarness 注入 toolRegistry
 * (解决 toolRegistry 晚于 agentHarness 实例化的顺序问题),并启动每 5 分钟健康检查
 * (多实例并发由 advisory lock 兜底,同一时刻只有一个实例实际探活)。
 */
import { pool, type Database } from '../../db/client.js';
import { logger } from '../logger.js';
import { ToolManagementService } from '../../contexts/tool-management/tool-management-service.js';
import { ToolRegistryService } from '../../contexts/tool-management/tool-registry-service.js';
import {
  ToolSourceRepository,
  ToolDefinitionRepository,
  ToolInstanceRepository,
  ToolCallLogRepository,
} from '../../db/repositories/tool-registry-repository.js';
import { McpClientPool } from '../../contexts/tool-management/mcp-client.js';
import { PgAdvisoryLockProvider } from '../../contexts/scheduler/pg-advisory-lock.js';
import type { CredentialService } from '../../contexts/credential-vault/credential-service.js';
import type { NotificationService } from '../../contexts/notification/notification-service.js';
import type { AgentHarness } from '../../contexts/agent-core/harness/harness.js';

export interface ToolBundle {
  toolManagementService: ToolManagementService;
  toolRegistryService: ToolRegistryService;
}

export function buildToolBundle(
  db: Database,
  credentialService: CredentialService,
  notificationService: NotificationService,
  agentHarness: AgentHarness
): ToolBundle {
  const toolManagementService = new ToolManagementService(
    new ToolSourceRepository(db),
    new ToolDefinitionRepository(db),
    new ToolInstanceRepository(db),
    new ToolCallLogRepository(db),
    credentialService
  );
  const toolRegistryService = new ToolRegistryService(
    toolManagementService,
    new ToolSourceRepository(db),
    new McpClientPool(),
    notificationService,
    new PgAdvisoryLockProvider(pool)
  );
  // 激活 Agent 工具调用兜底(解决 toolRegistry 晚于 agentHarness 实例化的顺序问题)
  agentHarness.setToolRegistry(toolRegistryService);
  // P4: 定时工具健康检查(每 5 分钟探活各 source、维护 healthStatus、转 down 告警)。
  setInterval(
    () => {
      void toolRegistryService.healthCheckAll().catch((err) => {
        logger.warn({ err: String(err) }, 'tool health check failed');
      });
    },
    5 * 60 * 1000
  );
  return { toolManagementService, toolRegistryService };
}
