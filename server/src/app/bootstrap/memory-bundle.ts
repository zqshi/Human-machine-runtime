/**
 * 数字员工记忆(Employee Memory)依赖组装。
 *
 * 从 `bootstrap.ts` 拆出:EmployeeMemoryRepository(持久化)+ Mem0Client(外部记忆服务)
 * + MemoryService(domain 组合:memory + knowledge + instance 回路)。knowledgeService
 * 条件启用(WeKnora 未配时为 null,MemoryService 仅召回 memory 侧)。
 */
import { Database } from '../../db/client.js';
import { EmployeeMemoryRepository } from '../../db/repositories/employee-memory-repository.js';
import { Mem0Client } from '../../contexts/employee-memory/mem0-client.js';
import { MemoryService } from '../../contexts/employee-memory/memory-service.js';
import type { KnowledgeService } from '../../contexts/knowledge/knowledge-service.js';
import type { InstanceRepository } from '../../db/repositories/instance-repository.js';

export interface MemoryBundle {
  memoryService: MemoryService;
}

export function buildMemoryBundle(
  db: Database,
  knowledgeService: KnowledgeService | null,
  instanceRepo: InstanceRepository
): MemoryBundle {
  const employeeMemoryRepo = new EmployeeMemoryRepository(db);
  const mem0Client = new Mem0Client();
  const memoryService = new MemoryService(
    employeeMemoryRepo,
    knowledgeService,
    mem0Client,
    instanceRepo
  );
  return { memoryService };
}
