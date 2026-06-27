/**
 * 数字员工领域类型定义。
 *
 * 这些类型原定义在 infrastructure/api/hmrApiClient.ts，但 DDD 宪章要求
 * domain 层不得 import infrastructure。由于 domain/employee/selectEmployeeList.ts
 * 等纯领域逻辑依赖 Employee / AgentRuntime，类型定义必须上移至 domain 层。
 *
 * infrastructure 层（hmrApiClient.ts）改为从此处 import 并 re-export，
 * 保持全项目现有 `import { Employee } from '.../hmrApiClient'` 向后兼容。
 */

import type { InstanceScope } from '../shared/types';

export interface EmployeeJobPolicy {
  allow: string[];
  deny: string[];
  kpi: string[];
  escalationRule: string;
  shutdownRule: string;
}

export interface ApprovalLevelPolicy {
  requiredApprovals: number;
  requiredAnyRoles: string[];
  distinctRoles: boolean;
}

export interface EmployeeApprovalPolicy {
  byRisk: Record<string, ApprovalLevelPolicy>;
}

export interface EmployeeResourceConfig {
  compute: { cpu: string; memory: string; gpu: { type: string; count: number } | null };
  model: { primaryModel: string; fallbackModels: string[]; maxConcurrency: number };
  budget: { monthlyLimitCny: number; dailyLimitCny: number | null; alertThresholdPct: number };
  storage: { persistentVolumeSize: string; tempStorageSize: string };
  source: 'tenant_default' | 'custom';
  customizedAt: string | null;
  customizedBy: string | null;
}

/** Agent 运行时类型（cockpit / harness）。注意与 domain/agent/AgentRuntime 类同名但不同物。 */
export type AgentRuntime = 'cockpit' | 'harness';

export interface EmployeeRemote {
  podName?: string;
  nodeName?: string;
  restarts?: number;
  nodeStatus?: 'healthy' | 'warning' | 'unhealthy';
  cluster?: string;
  runtimeTemplate?: string;
  agentRevision?: string;
  runMode?: 'single' | 'persistent';
  heartbeat?: string;
  healthStatus?: 'healthy' | 'warning' | 'unhealthy';
}

export interface Employee {
  id: string;
  name: string;
  displayName?: string;
  employeeNo?: string;
  email?: string;
  tenantId?: string;
  matrixRoomId?: string;
  department?: string;
  departmentId?: string;
  role?: string;
  jobTitle?: string;
  riskLevel?: string;
  status?: string;
  matrixUserId?: string;
  model?: string;
  personality?: string;
  createdAt?: string;
  jobPolicy?: EmployeeJobPolicy;
  approvalPolicy?: EmployeeApprovalPolicy;
  resources?: EmployeeResourceConfig;
  capabilities?: string[];
  knowledge?: string[];
  linkedSkillIds?: string[];
  certifications?: string[];
  careerPath?: string;
  scope?: InstanceScope;
  ownerId?: string;
  agentRuntime?: AgentRuntime;
  remote?: EmployeeRemote;
  [key: string]: unknown;
}
