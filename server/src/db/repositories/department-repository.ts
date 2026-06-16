import { eq, and } from 'drizzle-orm';
import type { Database } from '../client.js';
import { departments } from '../schema/department.js';
import type { IDepartmentRepository } from '../../contexts/department/department-service.js';
import type { Department } from '../../contexts/department/domain/department.js';

export class DepartmentRepository implements IDepartmentRepository {
  constructor(private db: Database) {}

  async findAll(tenantId?: string): Promise<Department[]> {
    const rows = tenantId
      ? await this.db.select().from(departments).where(eq(departments.tenantId, tenantId))
      : await this.db.select().from(departments);
    return rows.map(toDepartmentDomain);
  }

  async findById(id: string): Promise<Department | undefined> {
    const [row] = await this.db.select().from(departments).where(eq(departments.id, id)).limit(1);
    return row ? toDepartmentDomain(row) : undefined;
  }

  async findByTenantAndSlug(tenantId: string, slug: string): Promise<Department | undefined> {
    const [row] = await this.db
      .select()
      .from(departments)
      .where(and(eq(departments.tenantId, tenantId), eq(departments.slug, slug)))
      .limit(1);
    return row ? toDepartmentDomain(row) : undefined;
  }

  async findByTenantAndName(tenantId: string, name: string): Promise<Department | undefined> {
    const [row] = await this.db
      .select()
      .from(departments)
      .where(and(eq(departments.tenantId, tenantId), eq(departments.name, name)))
      .limit(1);
    return row ? toDepartmentDomain(row) : undefined;
  }

  async save(dept: Department): Promise<void> {
    const values = toDepartmentRow(dept);
    await this.db
      .insert(departments)
      .values(values)
      .onConflictDoUpdate({ target: departments.id, set: values });
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(departments).where(eq(departments.id, id));
  }
}

function toDepartmentDomain(row: typeof departments.$inferSelect): Department {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    slug: row.slug,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDepartmentRow(dept: Department) {
  return {
    id: dept.id,
    tenantId: dept.tenantId,
    name: dept.name,
    slug: dept.slug,
    description: dept.description,
    createdAt: new Date(dept.createdAt),
    updatedAt: new Date(dept.updatedAt),
  };
}
