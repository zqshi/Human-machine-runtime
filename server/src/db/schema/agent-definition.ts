import { pgTable, varchar, integer, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenant.js';

/* ──── Agent 定义 CRD(v1.3) ──── */

/**
 * agent_definitions — Agent 定义声明式 spec(云原生 CRD 概念)。
 *
 * 与 agent_profiles(人格展示档案,从 portal 同步)区分:本表是**声明式 spec**,
 * 由本地维护,含版本(generation 世代)、沙箱模板引用、资源限制、工作目录策略、
 * 绑定工具/skill、模型配置。instance 通过 agentDefinitionId + agentGeneration 引用本表。
 *
 * spec 各字段为 jsonb:resourceLimits/workspaceStrategy/boundTools/boundSkills/modelConfig
 *   - resourceLimits: ResourceConfig 结构(domain/instance.ts),CPU/内存/GPU/PVC/model/budget
 *   - workspaceStrategy: { type: 'pvc'|'emptyDir', size }
 *   - boundTools/boundSkills: string[](引用名,v1.4 组装层消费)
 *   - modelConfig: { primaryModel, fallbackModels, maxConcurrency }
 *
 * generation 是 spec 世代(每次 spec 变更递增),区别于 instances.version(乐观锁)。
 */
export const agentDefinitions = pgTable(
  'agent_definitions',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 128 }).notNull(),
    /** spec 版本号(世代),每次 spec 变更递增;与 instances.version(乐观锁)区分 */
    generation: integer('generation').notNull().default(1),
    /** 沙箱模板引用名(v1.4 才有模板池,本期先存名,默认 'basic') */
    sandboxTemplate: varchar('sandbox_template', { length: 64 }).notNull().default('basic'),
    /** 资源限制 spec(ResourceConfig 结构,见 domain/instance.ts) */
    resourceLimits: jsonb('resource_limits').$type<Record<string, unknown>>().notNull(),
    /** 工作目录策略:{ type: 'pvc'|'emptyDir', size } */
    workspaceStrategy: jsonb('workspace_strategy')
      .$type<{ type: 'pvc' | 'emptyDir'; size: string }>()
      .notNull()
      .default({ type: 'pvc', size: '2Gi' }),
    /** 绑定工具名列表(v1.4 组装层消费) */
    boundTools: jsonb('bound_tools').$type<string[]>().notNull().default([]),
    /** 绑定 skill 名列表(v1.4 组装层消费) */
    boundSkills: jsonb('bound_skills').$type<string[]>().notNull().default([]),
    /** 模型配置:{ primaryModel, fallbackModels, maxConcurrency } */
    modelConfig: jsonb('model_config').$type<Record<string, unknown>>().notNull().default({}),
    /** v1.9:人设与拒答声明(AgentPersonaSpec,见 domain/agent-definition.ts) */
    persona: jsonb('persona').$type<Record<string, unknown>>().notNull().default({}),
    /** v1.9:绑定知识库 id 列表(RAG 召回范围约束) */
    boundKnowledge: jsonb('bound_knowledge').$type<string[]>().notNull().default([]),
    /** v1.9:运行时声明(RuntimeDeclaration,治本 D8) */
    runtime: jsonb('runtime')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({ runtimeType: 'claude' }),
    description: varchar('description', { length: 512 }),
    status: varchar('status', { length: 32 }).notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_agent_definitions_tenant').on(table.tenantId),
    index('idx_agent_definitions_name').on(table.name),
  ]
);
