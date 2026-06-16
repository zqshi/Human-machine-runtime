import { useState, useEffect, useRef, useCallback } from 'react';
import { platformUserApi, platformRoleApi } from '../../../application/services/adminApi';
import { Modal } from '../../components/ui/Modal';
import { Icon } from '../../components/ui/Icon';

type PlatformRole = { id: string; name: string };

export function PlatformUsersSection() {
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [roles, setRoles] = useState<PlatformRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([platformUserApi.list({ role: roleFilter || undefined }), platformRoleApi.list()])
      .then(([u, r]) => {
        setUsers(u.users || []);
        setRoles((r.roles || []) as unknown as PlatformRole[]);
      })
      .catch(() => {
        setUsers([]);
        setRoles([]);
      })
      .finally(() => setLoading(false));
  }, [roleFilter]);
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);
  useEffect(() => { loadRef.current(); }, [roleFilter]);

  const handleToggle = async (id: string) => {
    await platformUserApi.toggleDisable(id);
    load();
  };

  const handleResetPw = async (id: string) => {
    await platformUserApi.resetPassword(id);
    alert('密码重置成功');
  };

  const openCreate = () => {
    setEditUserId(null);
    setEditorOpen(true);
  };
  const openEdit = (id: string) => {
    setEditUserId(id);
    setEditorOpen(true);
  };

  const roleLabel = (roleId: string) => roles.find((r) => r.id === roleId)?.name || roleId;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">平台用户</h1>
          <p className="text-xs text-gray-400 mt-0.5">运营平台账号与角色分配</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white"
          >
            <option value="">全部角色</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <button
            onClick={openCreate}
            className="px-3 py-1.5 text-sm bg-[#007AFF] text-white rounded-lg hover:bg-[#0066DD]"
          >
            <Icon name="person_add" size={14} className="mr-1 align-[-2px]" />
            新建用户
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
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">用户</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">邮箱</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">角色</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">来源</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500">状态</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={String(u.id)} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-gray-800">
                      {String(u.name || u.username || '—')}
                    </div>
                    <div className="text-xs text-gray-400 font-mono">
                      {String(u.username || u.id)}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 text-xs">{String(u.email || '—')}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700">
                      {roleLabel(String(u.role))}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${u.source === 'dynamic' ? 'bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {u.source === 'dynamic' ? '动态' : '系统'}
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
                        onClick={() => openEdit(String(u.id))}
                        className="p-1 text-gray-400 hover:text-[#007AFF]"
                        title="编辑"
                      >
                        <Icon name="edit" size={16} />
                      </button>
                      <button
                        onClick={() => handleToggle(String(u.id))}
                        className="p-1 text-gray-400 hover:text-yellow-600"
                        title={u.disabled ? '启用' : '禁用'}
                      >
                        <Icon name={u.disabled ? 'toggle_on' : 'toggle_off'} size={16} />
                      </button>
                      <button
                        onClick={() => handleResetPw(String(u.id))}
                        className="p-1 text-gray-400 hover:text-red-500"
                        title="重置密码"
                      >
                        <Icon name="key" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    暂无用户
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editorOpen && (
        <PlatformUserEditor
          userId={editUserId}
          users={users}
          roles={roles}
          onClose={() => setEditorOpen(false)}
          onSaved={() => {
            setEditorOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function buildForm(userId: string | null, users: Record<string, unknown>[], roles: PlatformRole[]) {
  if (userId) {
    const user = users.find((u) => String(u.id) === userId);
    if (user)
      return {
        username: String(user.username || ''),
        name: String(user.name || ''),
        email: String(user.email || ''),
        role: String(user.role || ''),
        password: '',
      };
  }
  const defaultRole = roles.find((r) => r.id !== 'platform_admin')?.id || roles[0]?.id || '';
  return { username: '', name: '', email: '', role: defaultRole, password: '' };
}

function PlatformUserEditor({
  userId,
  users,
  roles,
  onClose,
  onSaved,
}: {
  userId: string | null;
  users: Record<string, unknown>[];
  roles: PlatformRole[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(() => buildForm(userId, users, roles));
  const [saving, setSaving] = useState(false);
  const isEdit = !!userId;

  const [prevUserId, setPrevUserId] = useState(userId);
  if (userId !== prevUserId) {
    setPrevUserId(userId);
    setForm(buildForm(userId, users, roles));
  }

  const save = async () => {
    if (!form.username.trim() || !form.role) return;
    if (!isEdit && !form.password) return;
    setSaving(true);
    try {
      const payload = {
        username: form.username,
        displayName: form.name,
        email: form.email,
        role: form.role,
        ...(!isEdit && form.password ? { password: form.password } : {}),
      };
      if (isEdit) await platformUserApi.update(userId!, payload);
      else await platformUserApi.create(payload);
      onSaved();
    } catch {
      /* ignore */
    }
    setSaving(false);
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? '编辑用户' : '新建用户'} width="max-w-md">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-0.5">用户名 *</label>
            <input
              type="text"
              value={form.username}
              disabled={isEdit}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:bg-gray-50 disabled:text-gray-400"
              placeholder="小写字母、数字"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-0.5">显示名称</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
              placeholder="中文姓名"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-0.5">邮箱</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
            placeholder="user@example.com"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-0.5">角色 *</label>
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-gray-400 mt-1">角色的页面权限在「角色管理」中配置</p>
        </div>
        {!isEdit && (
          <div>
            <label className="text-xs text-gray-500 block mb-0.5">初始密码 *</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
              placeholder="至少 6 位"
            />
          </div>
        )}
        <button
          onClick={save}
          disabled={saving}
          className="w-full py-2 text-sm bg-[#007AFF] text-white rounded-lg hover:bg-[#0066DD] disabled:opacity-50"
        >
          {saving ? '保存中...' : isEdit ? '保存' : '创建'}
        </button>
      </div>
    </Modal>
  );
}
