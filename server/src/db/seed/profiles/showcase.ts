import type { SeedData, SeedProfile } from '../types.js';
import { seedData as productionSeed } from './production.js';

export const seedData: SeedData = {
  users: [
    ...productionSeed.users,
    {
      username: 'test1',
      password: 'test123',
      role: 'tenant_admin',
      scope: 'tenant',
      displayName: '测试用户1',
      email: 'test1@example.com',
      tenantId: 'default',
    },
    {
      username: 'test2',
      password: 'test123',
      role: 'tenant_admin',
      scope: 'tenant',
      displayName: '测试用户2',
      email: 'test2@example.com',
      tenantId: 'default',
    },
    {
      username: 'test3',
      password: 'test123',
      role: 'tenant_ops',
      scope: 'tenant',
      displayName: '测试用户3',
      email: 'test3@example.com',
      tenantId: 'default',
    },
    {
      username: 'test4',
      password: 'test123',
      role: 'tenant_ops',
      scope: 'tenant',
      displayName: '测试用户4',
      email: 'test4@example.com',
      tenantId: 'default',
    },
    {
      username: 'test5',
      password: 'test123',
      role: 'tenant_auditor',
      scope: 'tenant',
      displayName: '测试用户5',
      email: 'test5@example.com',
      tenantId: 'default',
    },
  ],

  tenant: productionSeed.tenant,

  instances: [
    ...productionSeed.instances,
    {
      id: 'inst_showcase_06',
      tenantId: 'default',
      name: 'Finance Assistant — Alice',
      source: 'api',
      type: 'openclaw',
      state: 'running',
      creator: 'tenant_admin',
      employeeNo: 'DE20260101001',
      employeeId: 'DE20260101001',
      jobTitle: '财务分析专员',
      department: 'finance',
    },
    {
      id: 'inst_showcase_07',
      tenantId: 'default',
      name: 'HR Assistant — Carol',
      source: 'api',
      type: 'openclaw',
      state: 'running',
      creator: 'tenant_admin',
      employeeNo: 'DE20260102001',
      employeeId: 'DE20260102001',
      jobTitle: '人事管理专员',
      department: 'human-resources',
    },
    {
      id: 'inst_showcase_08',
      tenantId: 'default',
      name: 'Engineering Assistant — David',
      source: 'api',
      type: 'openclaw',
      state: 'creating',
      creator: 'ops',
      employeeNo: 'DE20260103001',
      employeeId: 'DE20260103001',
      jobTitle: '开发工程师',
      department: 'engineering',
    },
  ],

  systemConfigs: [
    ...productionSeed.systemConfigs,
    { key: 'feature.decision_console', value: 'true', description: '决策控制台（HMR 新增）' },
    { key: 'feature.multi_tenant', value: 'true', description: '多租户管理（HMR 新增）' },
    { key: 'feature.rbac', value: 'true', description: 'RBAC 细粒度权限（HMR 新增）' },
    { key: 'feature.audit_center', value: 'true', description: '统一审计中心（HMR 新增）' },
    { key: 'feature.mcp_policy', value: 'true', description: 'MCP 策略管控（HMR 新增）' },
    { key: 'feature.credential_vault', value: 'true', description: '凭据保险箱（HMR 新增）' },
  ],
};

export const profile: SeedProfile = {
  name: 'showcase',
  seed: seedData,
};
