import { useState, useEffect, useCallback } from 'react';
import { authMgmtApi } from '../../../application/services/adminApi';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Icon } from '../../components/ui/Icon';
import { AuthUserDrawer } from './AuthUserDrawer';
import { AuthRoleDrawer } from './AuthRoleDrawer';

export function AuthSection() {
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [roles, setRoles] = useState<Record<string, unknown>[]>([]);
  const [tab, setTab] = useState<'users' | 'roles'>('users');
  const [loading, setLoading] = useState(true);

  const [userDrawer, setUserDrawer] = useState<{ open: boolean; userId: string | null }>({
    open: false,
    userId: null,
  });
  const [roleDrawer, setRoleDrawer] = useState<{ open: boolean; roleName: string | null }>({
    open: false,
    roleName: null,
  });
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'user' | 'role';
    id: string;
    label: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 拉取数据（不含 setLoading，供 effect 及 interval 使用）
  const fetchData = useCallback(() => {
    Promise.all([authMgmtApi.listUsers(), authMgmtApi.listRoles()])
      .then(([u, r]) => {
        setUsers(u.users || []);
        setRoles(r.roles || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // 供手动刷新用（带 loading 态）
  const load = useCallback(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  useEffect(fetchData, [fetchData]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === 'user') await authMgmtApi.deleteUser(deleteTarget.id);
      else await authMgmtApi.deleteRole(deleteTarget.id);
      load();
    } catch {
      /* ignore */
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {(['users', 'roles'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${tab === t ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
            >
              {t === 'users' ? '用户' : '角色'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {tab === 'users' ? (
            <button
              onClick={() => setUserDrawer({ open: true, userId: null })}
              className="px-3 py-1.5 text-xs bg-[#007AFF] text-white rounded-lg hover:bg-[#0066DD]"
            >
              <Icon name="person_add" size={14} className="mr-1 align-[-2px]" />
              新建用户
            </button>
          ) : (
            <button
              onClick={() => setRoleDrawer({ open: true, roleName: null })}
              className="px-3 py-1.5 text-xs bg-[#007AFF] text-white rounded-lg hover:bg-[#0066DD]"
            >
              <Icon name="add" size={14} className="mr-1 align-[-2px]" />
              新建角色
            </button>
          )}
          <button onClick={load} className="p-1.5 text-gray-400 hover:text-[#007AFF]" title="刷新">
            <Icon name="refresh" size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">加载中...</div>
      ) : tab === 'users' ? (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">用户名</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">邮箱</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">角色</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">状态</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={String(u.id)} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-800">
                    {String(u.username || '—')}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{String(u.email || '—')}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700">
                      {String(u.role || '—')}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${u.disabled ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}
                    >
                      {u.disabled ? '禁用' : '正常'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setUserDrawer({ open: true, userId: String(u.id) })}
                        className="p-1 text-gray-400 hover:text-[#007AFF]"
                        title="编辑"
                      >
                        <Icon name="edit" size={16} />
                      </button>
                      <button
                        onClick={() =>
                          setDeleteTarget({
                            type: 'user',
                            id: String(u.id),
                            label: String(u.username),
                          })
                        }
                        className="p-1 text-gray-400 hover:text-red-500"
                        title="删除"
                      >
                        <Icon name="delete" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    暂无用户
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">角色名</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">权限数</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">描述</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr
                  key={String(r.id || r.name)}
                  className="border-b border-gray-50 hover:bg-gray-50"
                >
                  <td className="px-4 py-2.5 font-medium text-gray-800">{String(r.name)}</td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {Array.isArray(r.permissions) ? r.permissions.length : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">
                    {String(r.description || '—')}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setRoleDrawer({ open: true, roleName: String(r.name) })}
                        className="p-1 text-gray-400 hover:text-[#007AFF]"
                        title="编辑"
                      >
                        <Icon name="edit" size={16} />
                      </button>
                      <button
                        onClick={() =>
                          setDeleteTarget({
                            type: 'role',
                            id: String(r.name),
                            label: String(r.name),
                          })
                        }
                        className="p-1 text-gray-400 hover:text-red-500"
                        title="删除"
                      >
                        <Icon name="delete" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
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

      <AuthUserDrawer
        open={userDrawer.open}
        userId={userDrawer.userId}
        users={users}
        roles={roles}
        onClose={() => setUserDrawer({ open: false, userId: null })}
        onSaved={load}
      />

      <AuthRoleDrawer
        open={roleDrawer.open}
        roleName={roleDrawer.roleName}
        roles={roles}
        onClose={() => setRoleDrawer({ open: false, roleName: null })}
        onSaved={load}
      />

      <ConfirmModal
        open={!!deleteTarget}
        title={`删除${deleteTarget?.type === 'user' ? '用户' : '角色'}`}
        message={`确定要删除${deleteTarget?.type === 'user' ? '用户' : '角色'}「${deleteTarget?.label}」吗？`}
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
