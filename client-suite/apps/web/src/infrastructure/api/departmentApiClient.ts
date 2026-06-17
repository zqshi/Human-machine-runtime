/**
 * Department API Client
 *
 * 部门实体 CRUD — 对接后端 /api/control/departments（v3.0 部门实体化）。
 * tenantId 从 auth session cookie 读取（与 weKnoraClient 同源），调用方无需显式传入。
 * 底层 request 由统一 httpClient 工厂提供。
 */
import { request } from './httpClient';

export interface Department {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

const BASE = '/api/control/departments';

interface Envelope<T> {
  success: boolean;
  data: T;
  total?: number;
}

/** 从 auth session cookie 读取当前租户 ID，dev 回退 'default'。 */
function getTenantId(): string {
  try {
    const raw = document.cookie.split(';').find((c) => c.trim().startsWith('tenantId='));
    if (raw) return raw.split('=')[1].trim();
  } catch {
    /* ignore */
  }
  return 'default';
}

export const departmentApi = {
  /** 列出当前租户的部门。tenantId 省略时自动从 cookie 取。 */
  list(tenantId?: string): Promise<Department[]> {
    const tid = tenantId || getTenantId();
    return request<Envelope<Department[]>>(`${BASE}?tenantId=${encodeURIComponent(tid)}`).then(
      (r) => Array.isArray(r.data) ? r.data : []
    );
  },

  get(id: string): Promise<Department> {
    return request<Envelope<Department>>(`${BASE}/${encodeURIComponent(id)}`).then((r) => r.data);
  },

  /** 新建部门。slug 由后端从 name 自动生成；tenantId 自动从 cookie 取。 */
  create(data: { name: string; slug?: string; description?: string; tenantId?: string }): Promise<Department> {
    return request<Envelope<Department>>(BASE, {
      method: 'POST',
      body: JSON.stringify({
        tenantId: data.tenantId || getTenantId(),
        name: data.name,
        slug: data.slug,
        description: data.description,
      }),
    }).then((r) => r.data);
  },

  update(id: string, data: { name?: string; description?: string }): Promise<Department> {
    return request<Envelope<Department>>(`${BASE}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }).then((r) => r.data);
  },

  remove(id: string): Promise<{ success: boolean }> {
    return request(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};
