import { useState, useEffect, useRef, useCallback } from 'react';
import { platformRoleApi } from '../../../application/services/adminApi';
import { Modal } from '../../components/ui/Modal';
import { Icon } from '../../components/ui/Icon';

const PAGE_PERMISSIONS: { key: string; label: string; icon: string }[] = [
  { key: 'tenants', label: '租户管理', icon: 'apartment' },
  { key: 'users', label: '平台用户', icon: 'group' },
  { key: 'roles', label: '角色管理', icon: 'admin_panel_settings' },
  { key: 'config', label: '平台配置', icon: 'tune' },
  { key: 'monitoring', label: '平台监控', icon: 'monitoring' },
  { key: 'audit', label: '审计日志', icon: 'receipt_long' },
];

const ALL_PAGE_KEYS = PAGE_PERMISSIONS.map((p) => p.key);

type Role = {
  id: number;
  name: string;
  displayName: string;
  permissions: string[];
  createdAt: string;
};

export function PlatformRolesSection() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editRoleId, setEditRoleId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    platformRoleApi
      .list()
      .then((r) => setRoles((r.roles || []) as unknown as Role[]))
      .catch(() => setRoles([]))
      .finally(() => setLoading(false));
  }, []);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  useEffect(() => {
    loadRef.current();
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await platformRoleApi.delete(String(deleteTarget.id));
    setDeleteTarget(null);
    load();
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">角色管理</h1>
          <p className="text-xs text-gray-400 mt-0.5">定义角色权限与页面访问范围</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditRoleId(null);
              setEditorOpen(true);
            }}
            className="px-3 py-1.5 text-sm bg-[#007AFF] text-white rounded-lg hover:bg-[#0066DD]"
          >
            <Icon name="add" size={14} className="mr-1 align-[-2px]" />
            新建角色
          </button>
          <button onClick={load} className="p-1.5 text-gray-400 hover:text-[#007AFF]" title="刷新">
            <Icon name="refresh" size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">加载中...</div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">角色标识</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">显示名称</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">页面权限</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => {
                const isBuiltIn = r.name === 'platform_admin';
                return (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">{r.name}</span>
                        {isBuiltIn && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                            内置
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 text-xs">{r.displayName}</td>
                    <td className="px-4 py-2.5">
                      {isBuiltIn ? (
                        <span className="text-xs text-[#007AFF] font-medium">全部权限</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(r.permissions || []).map((p) => {
                            const perm = PAGE_PERMISSIONS.find((pp) => pp.key === p);
                            return perm ? (
                              <span
                                key={p}
                                className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600"
                              >
                                <Icon name={perm.icon} size={10} />
                                {perm.label}
                              </span>
                            ) : (
                              <span
                                key={p}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600"
                              >
                                {p}
                              </span>
                            );
                          })}
                          {(!r.permissions || r.permissions.length === 0) && (
                            <span className="text-xs text-gray-300">无</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {!isBuiltIn && (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditRoleId(String(r.id));
                              setEditorOpen(true);
                            }}
                            className="p-1 text-gray-400 hover:text-[#007AFF]"
                            title="编辑"
                          >
                            <Icon name="edit" size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(r)}
                            className="p-1 text-gray-400 hover:text-red-500"
                            title="删除"
                          >
                            <Icon name="delete" size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {roles.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    暂无角色
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editorOpen && (
        <RoleEditor
          roleId={editRoleId}
          roles={roles}
          onClose={() => setEditorOpen(false)}
          onSaved={() => {
            setEditorOpen(false);
            load();
          }}
        />
      )}

      {deleteTarget && (
        <Modal open onClose={() => setDeleteTarget(null)} title="确认删除" width="max-w-sm">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              确定删除角色 <strong>{deleteTarget.name}</strong>（{deleteTarget.displayName}）？
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="px-3 py-1.5 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600"
              >
                删除
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function RoleEditor({
  roleId,
  roles,
  onClose,
  onSaved,
}: {
  roleId: string | null;
  roles: Role[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!roleId;
  const existing = roleId ? roles.find((r) => String(r.id) === roleId) : null;

  const [form, setForm] = useState(() =>
    existing
      ? {
          name: existing.name,
          displayName: existing.displayName,
          permissions: [...(existing.permissions || [])],
        }
      : { name: '', displayName: '', permissions: [] as string[] }
  );
  const [saving, setSaving] = useState(false);

  const prevExistingRef = useRef(existing);
  if (existing !== prevExistingRef.current) {
    prevExistingRef.current = existing;
    if (existing) {
      setForm({
        name: existing.name,
        displayName: existing.displayName,
        permissions: [...(existing.permissions || [])],
      });
    } else {
      setForm({ name: '', displayName: '', permissions: [] });
    }
  }

  const togglePage = (key: string) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(key)
        ? f.permissions.filter((p) => p !== key)
        : [...f.permissions, key],
    }));
  };

  const save = async () => {
    if (!form.name.trim() || !form.displayName.trim()) return;
    setSaving(true);
    try {
      if (isEdit) await platformRoleApi.update(roleId!, form);
      else await platformRoleApi.create(form);
      onSaved();
    } catch {
      /* ignore */
    }
    setSaving(false);
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? '编辑角色' : '新建角色'} width="max-w-md">
      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-500 block mb-0.5">角色名称 *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
            placeholder="如：运维工程师"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-0.5">显示名称 *</label>
          <input
            type="text"
            value={form.displayName}
            onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
            placeholder="如：运维工程师"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-gray-500">页面权限</label>
            <button
              type="button"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  permissions:
                    f.permissions.length === ALL_PAGE_KEYS.length ? [] : [...ALL_PAGE_KEYS],
                }))
              }
              className="text-[11px] text-[#007AFF] hover:underline"
            >
              {form.permissions.length === ALL_PAGE_KEYS.length ? '取消全选' : '全选'}
            </button>
          </div>
          <div className="border border-gray-200 rounded-lg p-2.5 space-y-1">
            {PAGE_PERMISSIONS.map((p) => (
              <label
                key={p.key}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={form.permissions.includes(p.key)}
                  onChange={() => togglePage(p.key)}
                  className="w-3.5 h-3.5 rounded border-gray-300 text-[#007AFF] focus:ring-[#007AFF]"
                />
                <Icon name={p.icon} size={16} className="text-gray-400" />
                <span className="text-sm text-gray-700">{p.label}</span>
              </label>
            ))}
          </div>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="w-full py-2 text-sm bg-[#007AFF] text-white rounded-lg hover:bg-[#0066DD] disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </Modal>
  );
}
