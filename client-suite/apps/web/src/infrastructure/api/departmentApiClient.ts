/**
 * Department API Client
 *
 * 部门实体 CRUD — 对接后端 /api/control/departments（v3.0 部门实体化）。
 * tenantId 从 auth session cookie 读取（与 weKnoraClient 同源），调用方无需显式传入。
 */
import { ApiError } from './hmrApiClient';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (path.includes('/undefined') || path.includes('/null')) {
    return Promise.reject(new Error(`invalid API path: ${path}`));
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(path, {
      credentials: 'include',
      signal: controller.signal,
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
    if (!res.ok) {
      let body: unknown;
      try { body = await res.json(); } catch { /* ignore */ }
      throw new ApiError(res.status, res.statusText, body);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : (undefined as T);
  } finally {
    clearTimeout(timeoutId);
  }
}

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
