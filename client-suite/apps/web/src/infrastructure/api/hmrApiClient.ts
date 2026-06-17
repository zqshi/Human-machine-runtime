/**
 * HMR Backend API Client
 *
 * Wraps fetch() for the HMR backend REST API.
 * Uses cookie-based session auth (Set-Cookie: hmr_admin_session).
 * In dev mode, Vite proxy forwards /api → http://127.0.0.1:3000.
 *
 * 底层 request 与 ApiError 由统一 httpClient 工厂提供，此处 re-export 以保持
 * 现有 `import { ApiError } from './hmrApiClient'` 的向后兼容。
 */

import { request, ApiError } from './httpClient';
import type { InstanceScope } from '../../domain/shared/types';

export { ApiError, request };

// ─── Auth ────────────────────────────────────────────────────────────

export interface AuthUser {
  username: string;
  role: string;
  tenantId?: string;
  permissions?: string[];
}

export interface LoginResult {
  authenticated: boolean;
  user?: AuthUser;
  expiresInSec?: number;
  error?: string;
}

export interface AuthProviderInfo {
  type: string;
  label: string;
  enabled: boolean;
}

export interface SSOAuthorizeResult {
  redirectUrl: string;
}

export interface SSOCallbackResult {
  authenticated: boolean;
  user?: AuthUser;
  expiresInSec?: number;
  error?: string;
}

export const authApi = {
  async login(username: string, password: string): Promise<LoginResult> {
    try {
      const raw = await request<{
        success: boolean;
        data?: { user?: AuthUser; sessionId?: string };
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      return {
        authenticated: !!raw.success && !!raw.data?.user,
        user: raw.data?.user,
      };
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        const msg = (err.body as { error?: string })?.error || '用户名或密码错误';
        return { authenticated: false, error: msg };
      }
      throw err;
    }
  },

  async me(): Promise<{ authenticated: boolean; user?: AuthUser }> {
    const raw = await request<{ success: boolean; data?: AuthUser }>('/api/auth/me');
    return {
      authenticated: !!raw.success && !!raw.data,
      user: raw.data || undefined,
    };
  },

  logout(): Promise<void> {
    return request('/api/auth/logout', { method: 'POST' });
  },

  acl(): Promise<{ navItems: Record<string, unknown>[] }> {
    return request('/api/auth/acl');
  },

  providers(): Promise<{ providers: AuthProviderInfo[] }> {
    return request('/api/auth/providers');
  },

  async ssoAuthorize(provider?: string): Promise<SSOAuthorizeResult> {
    const qs = provider ? `?provider=${encodeURIComponent(provider)}` : '';
    const raw = await request<{ success: boolean; data?: { url: string; state?: string } }>(
      `/api/auth/sso/authorize${qs}`
    );
    return { redirectUrl: raw.data?.url ?? '' };
  },

  async ssoCallback(code: string, state: string): Promise<SSOCallbackResult> {
    const raw = await request<{ success: boolean; data?: { user?: AuthUser; sessionId?: string } }>(
      '/api/auth/sso/callback',
      {
        method: 'POST',
        body: JSON.stringify({ code, state }),
      }
    );
    return {
      authenticated: !!raw.success && !!raw.data?.user,
      user: raw.data?.user,
    };
  },
};

// ─── Employees ───────────────────────────────────────────────────────
// 类型定义已上移至 domain/employee/types.ts（DDD 分层：domain 不得被 infrastructure 引用，
// 反向合法）。此处 re-export 以保持全项目 `import { Employee } from './hmrApiClient'` 向后兼容。
import type {
  EmployeeJobPolicy,
  ApprovalLevelPolicy,
  EmployeeApprovalPolicy,
  EmployeeResourceConfig,
  AgentRuntime,
  EmployeeRemote,
  Employee,
} from '../../domain/employee/types';

export type {
  EmployeeJobPolicy,
  ApprovalLevelPolicy,
  EmployeeApprovalPolicy,
  EmployeeResourceConfig,
  AgentRuntime,
  EmployeeRemote,
  Employee,
};

export const employeeApi = {
  list(): Promise<Employee[]> {
    return request('/api/admin/employees');
  },

  get(id: string): Promise<Employee> {
    return request(`/api/admin/employees/${encodeURIComponent(id)}`);
  },

  create(data: {
    name: string;
    displayName?: string;
    department?: string;
    departmentId?: string;
    role?: string;
    jobTitle?: string;
    scope: InstanceScope;
    ownerId?: string;
    channelId?: string;
    channelAppId?: string;
    riskLevel?: string;
    description?: string;
  }): Promise<Employee> {
    return request('/api/admin/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  requestPersonalInstance(data: {
    name: string;
    department?: string;
    role?: string;
  }): Promise<Employee> {
    return request('/api/admin/employees/request-personal', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// ─── Shared Agents ───────────────────────────────────────────────────

export interface SharedAgentDTO {
  id: string;
  name: string;
  category: string;
  description?: string;
  status?: string;
  source?: string;
  matrixUserId?: string;
  [key: string]: unknown;
}

export const agentApi = {
  listShared(params?: {
    keyword?: string;
    status?: string;
    ownerEmployeeId?: string;
  }): Promise<{ rows: SharedAgentDTO[]; summary: Record<string, unknown> }> {
    const qs = new URLSearchParams();
    if (params?.keyword) qs.set('keyword', params.keyword);
    if (params?.status) qs.set('status', params.status);
    if (params?.ownerEmployeeId) qs.set('ownerEmployeeId', params.ownerEmployeeId);
    const q = qs.toString();
    return request(`/api/admin/agents/shared${q ? `?${q}` : ''}`);
  },

  register(data: Partial<SharedAgentDTO>): Promise<Record<string, unknown>> {
    return request('/api/admin/agents/shared/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  recommend(params?: {
    jobCode?: string;
    keyword?: string;
  }): Promise<{ rows: SharedAgentDTO[]; summary: Record<string, unknown> }> {
    const qs = new URLSearchParams();
    if (params?.jobCode) qs.set('jobCode', params.jobCode);
    if (params?.keyword) qs.set('keyword', params.keyword);
    const q = qs.toString();
    return request(`/api/admin/agents/shared/recommend${q ? `?${q}` : ''}`);
  },
};

// ─── Notifications ───────────────────────────────────────────────────

export interface NotificationDTO {
  id: string;
  type: string;
  title: string;
  body?: string;
  read?: boolean;
  createdAt?: string;
  [key: string]: unknown;
}

export const notificationApi = {
  list(): Promise<{ items: NotificationDTO[]; summary: Record<string, unknown> }> {
    return request('/api/admin/notifications');
  },
};

// ─── Tasks ───────────────────────────────────────────────────────────

export interface TaskDTO {
  id: string;
  name: string;
  status: string;
  progress?: number;
  [key: string]: unknown;
}

export const taskApi = {
  list(): Promise<TaskDTO[]> {
    return request('/api/openclaw/tasks');
  },

  get(id: string): Promise<TaskDTO> {
    return request(`/api/openclaw/tasks/${encodeURIComponent(id)}`);
  },
};

// ─── Documents ───────────────────────────────────────────────────────

export interface DocumentDTO {
  id: string;
  roomId?: string | null;
  type: 'doc' | 'code' | 'markdown' | 'sheet' | 'slide';
  title: string;
  content: {
    html?: string;
    _meta?: {
      folderId?: string | null;
      tags?: string[];
      starred?: boolean;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  status?: string;
  categoryId?: string | null;
  departmentId?: string | null;
  ownerId?: string;
  permissions?: Record<string, unknown>[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface DocumentFilter {
  roomId?: string;
  folderId?: string;
  status?: string;
  categoryId?: string;
  departmentId?: string;
  ownerId?: string;
  starred?: boolean;
  search?: string;
}

export const documentApi = {
  list(filter: DocumentFilter = {}): Promise<{ documents: DocumentDTO[] }> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(filter)) {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    }
    const q = qs.toString();
    return request(`/api/control/documents${q ? `?${q}` : ''}`);
  },

  get(id: string): Promise<{ document: DocumentDTO }> {
    return request(`/api/control/documents/${encodeURIComponent(id)}`);
  },

  create(data: Partial<DocumentDTO>): Promise<{ document: DocumentDTO }> {
    return request('/api/control/documents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update(id: string, data: Partial<DocumentDTO>): Promise<{ document: DocumentDTO }> {
    return request(`/api/control/documents/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete(id: string): Promise<{ success: boolean }> {
    return request(`/api/control/documents/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  toggleStar(id: string): Promise<{ document: DocumentDTO }> {
    return request(`/api/control/documents/${encodeURIComponent(id)}/star`, {
      method: 'PATCH',
    });
  },

  submitForReview(
    id: string,
    actor?: { id?: string; name?: string }
  ): Promise<{ document: DocumentDTO }> {
    return request(`/api/control/documents/${encodeURIComponent(id)}/submit-review`, {
      method: 'POST',
      body: JSON.stringify({ actor }),
    });
  },

  approve(id: string, actor?: { id?: string; name?: string }): Promise<{ document: DocumentDTO }> {
    return request(`/api/control/documents/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      body: JSON.stringify({ actor }),
    });
  },

  reject(
    id: string,
    comment: string,
    actor?: { id?: string; name?: string }
  ): Promise<{ document: DocumentDTO }> {
    return request(`/api/control/documents/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ comment, actor }),
    });
  },

  publish(id: string, actor?: { id?: string; name?: string }): Promise<{ document: DocumentDTO }> {
    return request(`/api/control/documents/${encodeURIComponent(id)}/publish`, {
      method: 'POST',
      body: JSON.stringify({ actor }),
    });
  },

  archive(id: string, actor?: { id?: string; name?: string }): Promise<{ document: DocumentDTO }> {
    return request(`/api/control/documents/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
      body: JSON.stringify({ actor }),
    });
  },

  listVersions(documentId: string): Promise<{ versions: Record<string, unknown>[] }> {
    return request(`/api/control/documents/${encodeURIComponent(documentId)}/versions`);
  },

  restoreVersion(versionId: string): Promise<{ document: DocumentDTO }> {
    return request(`/api/control/documents/versions/${encodeURIComponent(versionId)}/restore`, {
      method: 'POST',
    });
  },

  getPermissions(documentId: string): Promise<{ permissions: Record<string, unknown>[] }> {
    return request(`/api/control/documents/${encodeURIComponent(documentId)}/permissions`);
  },

  updatePermissions(
    documentId: string,
    permissions: object[]
  ): Promise<{ permissions: Record<string, unknown>[] }> {
    return request(`/api/control/documents/${encodeURIComponent(documentId)}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions }),
    });
  },
};

// ─── Categories ─────────────────────────────────────────────────────

export const categoryApi = {
  list(): Promise<{ categories: Record<string, unknown>[] }> {
    return request('/api/control/categories');
  },

  get(id: string): Promise<{ category: Record<string, unknown> }> {
    return request(`/api/control/categories/${encodeURIComponent(id)}`);
  },

  create(data: {
    name: string;
    icon?: string;
    parentId?: string;
    departmentId?: string;
  }): Promise<{ category: Record<string, unknown> }> {
    return request('/api/control/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update(
    id: string,
    data: Partial<{ name: string; icon: string; description: string }>
  ): Promise<{ category: Record<string, unknown> }> {
    return request(`/api/control/categories/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete(id: string): Promise<{ success: boolean }> {
    return request(`/api/control/categories/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
};

// ─── Knowledge Audit Logs ───────────────────────────────────────────

export const knowledgeAuditApi = {
  list(filter?: {
    operationType?: string;
    operatorId?: string;
    search?: string;
    limit?: number;
  }): Promise<{ entries: Record<string, unknown>[] }> {
    const qs = new URLSearchParams();
    if (filter) {
      for (const [k, v] of Object.entries(filter)) {
        if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
      }
    }
    const q = qs.toString();
    return request(`/api/control/knowledge-audits${q ? `?${q}` : ''}`);
  },
};

// ─── Storage ────────────────────────────────────────────────────────

export const storageApi = {
  getStats(): Promise<{ stats: Record<string, unknown> }> {
    return request('/api/control/storage/stats');
  },

  getDeptStorage(): Promise<{ departments: Record<string, unknown>[] }> {
    return request('/api/control/storage/departments');
  },

  getLargeFiles(): Promise<{ files: Record<string, unknown>[] }> {
    return request('/api/control/storage/large-files');
  },
};

// ─── Uploads ─────────────────────────────────────────────────────────

export interface UploadResult {
  id: string;
  url: string;
  originalName: string;
  size: number;
  mimetype: string;
}

export const uploadApi = {
  async upload(file: File): Promise<{ file: UploadResult }> {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/control/uploads', {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    if (!res.ok) {
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        /* ignore */
      }
      throw new ApiError(res.status, res.statusText, body);
    }
    return res.json();
  },
};

// ─── Audit Logs ─────────────────────────────────────────────────────

export const logsApi = {
  list(): Promise<Record<string, unknown>[]> {
    return request('/api/admin/logs');
  },
};

// ─── Overview / Health ───────────────────────────────────────────────

export const systemApi = {
  overview(): Promise<Record<string, unknown>> {
    return request('/api/admin/dashboard/overview');
  },

  runtimeStatus(): Promise<Record<string, unknown>> {
    return request('/api/admin/runtime-status');
  },

  health(): Promise<Record<string, unknown>> {
    return request('/health');
  },

  matrixStatus(): Promise<Record<string, unknown>> {
    return request('/api/admin/matrix/status');
  },
};

// ─── OpenClaw ─────────────────────────────────────────────────────────

export const openclawApi = {
  async listRuntimes() {
    return request<{ runtimes: Record<string, unknown>[] }>('/api/admin/agents/runtime');
  },

  async listAgentTasks(agentId: string) {
    return request<{ tasks: Record<string, unknown>[] }>(
      `/api/admin/agents/${encodeURIComponent(agentId)}/tasks`
    );
  },

  async getTaskLogs(taskId: string) {
    return request<{ logs: Record<string, unknown>[] }>(
      `/api/admin/agents/tasks/${encodeURIComponent(taskId)}/logs`
    );
  },

  async channelStatuses() {
    return request<{ channels: Record<string, unknown>[] }>('/api/admin/channels/status');
  },
};

// ─── App Catalog ─────────────────────────────────────────────────────

export interface AppCatalogItem {
  id: number;
  name: string;
  icon: string;
  iconColor: string;
  category: string;
  description: string | null;
  status: string;
  sortOrder: number;
  visible: boolean;
}

export const appCatalogApi = {
  list(category?: string): Promise<{
    items: AppCatalogItem[];
    grouped: Record<string, AppCatalogItem[]>;
  }> {
    const qs = category ? `?category=${encodeURIComponent(category)}` : '';
    return request(`/api/control/app-catalog${qs}`);
  },
};
