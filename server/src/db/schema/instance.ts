import { pgTable, text, varchar, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { tenants } from './tenant.js';
import { departments } from './department.js';

export const instances = pgTable(
  'instances',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 64 })
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 128 }).notNull(),
    description: text('description'),
    source: varchar('source', { length: 32 }).notNull().default('api'),
    type: varchar('type', { length: 32 }).notNull().default('openclaw'),
    state: varchar('state', { length: 32 }).notNull().default('requested'),
    creator: varchar('creator', { length: 128 }),
    enterpriseUserId: varchar('enterprise_user_id', { length: 128 }),
    employeeNo: varchar('employee_no', { length: 32 }),
    employeeId: varchar('employee_id', { length: 64 }),
    email: varchar('email', { length: 255 }),
    jobCode: varchar('job_code', { length: 64 }),
    jobTitle: varchar('job_title', { length: 128 }),
    department: varchar('department', { length: 128 }),
    departmentId: varchar('department_id', { length: 64 })
      .references(() => departments.id, { onDelete: 'set null' }),
    matrixRoomId: varchar('matrix_room_id', { length: 128 }),
    permissionTemplateId: varchar('permission_template_id', { length: 64 }),
    permissionTemplate: jsonb('permission_template').$type<Record<string, unknown>>(),
    resources: jsonb('resources').$type<Record<string, string>>().default({}),
    runtime: jsonb('runtime').$type<Record<string, unknown>>().default({}),
    policy: jsonb('policy').$type<Record<string, unknown>>().default({}),
    approvalPolicy: jsonb('approval_policy').$type<Record<string, unknown>>().default({}),
    requestId: varchar('request_id', { length: 64 }),
    farmInstanceId: varchar('farm_instance_id', { length: 128 }),
    farmPodName: varchar('farm_pod_name', { length: 128 }),
    farmNamespace: varchar('farm_namespace', { length: 128 }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_instances_tenant').on(table.tenantId),
    index('idx_instances_state').on(table.state),
    index('idx_instances_farm').on(table.farmInstanceId),
    index('idx_instances_department').on(table.departmentId),
  ]
);
