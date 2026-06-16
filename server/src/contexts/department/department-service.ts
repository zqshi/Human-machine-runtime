import {
  type Department,
  type CreateDepartmentInput,
  type UpdateDepartmentInput,
  createDepartment,
  updateDepartment,
  slugify,
} from './domain/department.js';
import { AppError } from '../../shared/utils.js';

/* ---------- Repository interface ---------- */

export interface IDepartmentRepository {
  findAll(tenantId?: string): Promise<Department[]>;
  findById(id: string): Promise<Department | undefined>;
  findByTenantAndSlug(tenantId: string, slug: string): Promise<Department | undefined>;
  findByTenantAndName(tenantId: string, name: string): Promise<Department | undefined>;
  save(dept: Department): Promise<void>;
  delete(id: string): Promise<void>;
}

/* ---------- Service ---------- */

export class DepartmentService {
  constructor(private repo: IDepartmentRepository) {}

  async list(tenantId?: string): Promise<Department[]> {
    return this.repo.findAll(tenantId);
  }

  async get(id: string): Promise<Department> {
    const dept = await this.repo.findById(id);
    if (!dept) {
      throw new AppError(`department not found: ${id}`, 404, 'DEPARTMENT_NOT_FOUND');
    }
    return dept;
  }

  async create(input: CreateDepartmentInput): Promise<Department> {
    const name = String(input.name).trim();

    // tenant 内 name 唯一（跨租户允许同名）
    const nameConflict = await this.repo.findByTenantAndName(input.tenantId, name);
    if (nameConflict) {
      throw new AppError(
        `department name already exists in tenant`,
        409,
        'DEPARTMENT_NAME_CONFLICT'
      );
    }

    // slug 冲突（不同 name 可能产出同 slug，如 "Finance!" 与 "Finance"）→ 追加后缀重试
    let dept = createDepartment({ ...input, name });
    for (let attempts = 1; attempts <= 3; attempts++) {
      const slugConflict = await this.repo.findByTenantAndSlug(dept.tenantId, dept.slug);
      if (!slugConflict) break;
      dept = createDepartment({ ...input, name, slug: `${slugify(name)}-${attempts}` });
    }
    await this.repo.save(dept);
    return dept;
  }

  async update(id: string, patch: UpdateDepartmentInput): Promise<Department> {
    const dept = await this.get(id);

    if (patch.name !== undefined && patch.name.trim() !== dept.name) {
      const conflict = await this.repo.findByTenantAndName(dept.tenantId, patch.name.trim());
      if (conflict && conflict.id !== id) {
        throw new AppError(
          `department name already exists in tenant`,
          409,
          'DEPARTMENT_NAME_CONFLICT'
        );
      }
    }

    const updated = updateDepartment(dept, patch);
    await this.repo.save(updated);
    return updated;
  }

  async remove(id: string): Promise<{ id: string; deleted: true }> {
    await this.get(id);
    await this.repo.delete(id);
    return { id, deleted: true };
  }

  /**
   * 按 tenant+name 幂等查找或创建。供 instance 创建链路与数据迁移复用，
   * 保证"选已有部门或新建"语义稳定可重入。
   */
  async getOrCreateByTenantAndName(tenantId: string, name: string): Promise<Department> {
    const trimmed = String(name).trim();
    const existing = await this.repo.findByTenantAndName(tenantId, trimmed);
    if (existing) return existing;
    return this.create({ tenantId, name: trimmed });
  }
}
