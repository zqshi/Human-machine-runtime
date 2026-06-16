/**
 * Permission — 文档权限值对象
 */
export type PermissionLevel = 'admin' | 'edit' | 'comment' | 'view';

export interface DocumentPermission {
  userId: string;
  userName: string;
  level: PermissionLevel;
  grantedBy: string;
  grantedAt: string;
}

/** Permission level ordering (higher number = more access) */
const LEVEL_ORDER: Record<PermissionLevel, number> = {
  view: 1,
  comment: 2,
  edit: 3,
  admin: 4,
};

export function hasAtLeast(actual: PermissionLevel, required: PermissionLevel): boolean {
  return LEVEL_ORDER[actual] >= LEVEL_ORDER[required];
}
