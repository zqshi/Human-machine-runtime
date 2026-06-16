import { newId, nowIso } from '../../../shared/utils.js';

/* ---------- Department entity ---------- */

export interface Department {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDepartmentInput {
  tenantId: string;
  name: string;
  slug?: string;
  description?: string;
}

export interface UpdateDepartmentInput {
  name?: string;
  description?: string;
}

/* ---------- Constants ---------- */

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

/* ---------- Validation ---------- */

export function validateDepartmentName(name: unknown): string | null {
  const n = String(name ?? '').trim();
  if (!n) return 'department name is required';
  if (n.length > 128) return 'department name max 128 chars';
  return null;
}

export function validateSlug(slug: unknown): string | null {
  const s = String(slug ?? '').trim();
  if (!s) return 'slug is required';
  if (s.length > 64) return 'slug max 64 chars';
  if (!SLUG_RE.test(s)) return 'slug must be lowercase alphanumeric with dashes';
  return null;
}

/* ---------- slugify (pure, deterministic) ---------- */

function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

/**
 * 将名称转为 kebab-case slug。非 ASCII（如中文）名称无法产出可用 ascii，
 * 回退到基于名称的确定性短哈希（dept-<hash8>）——同名恒同 slug，冲突由
 * service 层追加后缀处理。纯函数，不含随机/时间依赖。
 */
export function slugify(name: unknown): string {
  const raw = String(name ?? '').trim().toLowerCase();
  const ascii = raw
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (ascii) return ascii.slice(0, 64);
  return `dept-${hashStr(String(name ?? '')).slice(0, 8)}`;
}

/* ---------- Factories ---------- */

export function createDepartment(input: CreateDepartmentInput): Department {
  const nameErr = validateDepartmentName(input.name);
  if (nameErr) throw new Error(nameErr);

  const tenantId = String(input.tenantId ?? '').trim();
  if (!tenantId) throw new Error('tenantId is required');

  const name = String(input.name).trim();
  const explicitSlug = input.slug ? String(input.slug).trim() : '';
  const slug = explicitSlug && !validateSlug(explicitSlug) ? explicitSlug : slugify(name);

  const now = nowIso();
  return {
    id: newId('dept'),
    tenantId,
    name,
    slug,
    description: String(input.description ?? '').trim(),
    createdAt: now,
    updatedAt: now,
  };
}

export function updateDepartment(dept: Department, patch: UpdateDepartmentInput): Department {
  if (patch.name !== undefined) {
    const err = validateDepartmentName(patch.name);
    if (err) throw new Error(err);
  }
  // slug intentionally immutable: it is a stable identifier. Renaming a dept
  // must not break Mem0 project_id/app_id derivations or external references.
  return {
    ...dept,
    ...(patch.name !== undefined ? { name: String(patch.name).trim() } : {}),
    ...(patch.description !== undefined ? { description: String(patch.description).trim() } : {}),
    slug: dept.slug,
    updatedAt: nowIso(),
  };
}
