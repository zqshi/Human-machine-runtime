import { useState, useMemo } from 'react';
import { Drawer } from '../../components/ui/Drawer';
import { Icon } from '../../components/ui/Icon';
import { authMgmtApi } from '../../../application/services/adminApi';

interface Props {
  open: boolean;
  userId: string | null;
  users: Record<string, unknown>[];
  roles: Record<string, unknown>[];
  onClose: () => void;
  onSaved: () => void;
}

const USERNAME_RE = /^[a-zA-Z0-9_]{2,32}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthUserDrawer({ open, userId, users, roles, onClose, onSaved }: Props) {
  // 编辑模式下的派生初始值
  const derivedEditForm = useMemo(() => {
    if (open && userId) {
      const user = users.find((u) => String(u.id) === userId);
      if (user) {
        return { role: String(user.role || '') };
      }
    }
    return { role: '' };
  }, [open, userId, users]);

  // 新建模式下的表单
  const [createForm, setCreateForm] = useState({
    username: '',
    email: '',
    password: '',
    role: '',
  });
  // 编辑模式下的表单
  const [editForm, setEditForm] = useState(derivedEditForm);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isEdit = !!userId;

  // prop 变化时重置表单
  const [prevKey, setPrevKey] = useState({ open, userId });
  if (open !== prevKey.open || userId !== prevKey.userId) {
    setPrevKey({ open, userId });
    setCreateForm({ username: '', email: '', password: '', role: '' });
    setEditForm(derivedEditForm);
    setShowPassword(false);
    setError('');
  }

  const validateCreate = (): string | null => {
    if (!createForm.username.trim()) return '用户名不能为空';
    if (!USERNAME_RE.test(createForm.username)) return '用户名需 2-32 位字母、数字或下划线';
    if (!createForm.email.trim()) return '邮箱不能为空';
    if (!EMAIL_RE.test(createForm.email)) return '邮箱格式不正确';
    if (!createForm.password) return '初始密码不能为空';
    if (createForm.password.length < 6) return '密码至少 6 个字符';
    return null;
  };

  const validateEdit = (): string | null => {
    return null;
  };

  const save = async () => {
    const validationError = isEdit ? validateEdit() : validateCreate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (isEdit) {
        await authMgmtApi.updateUser(userId!, editForm);
      } else {
        await authMgmtApi.createUser(createForm);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(String((e as Error).message || '保存失败'));
    }
    setSaving(false);
  };

  return (
    <Drawer open={open} onClose={onClose} title={isEdit ? '编辑用户' : '新建用户'}>
      <div className="space-y-3">
        {error && (
          <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
        )}

        {isEdit ? (
          /* ─── 编辑模式 ─── */
          <>
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">角色</label>
              <select
                value={editForm.role}
                onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
              >
                <option value="">选择角色...</option>
                {roles.map((r) => (
                  <option key={String(r.name)} value={String(r.name)}>
                    {String(r.displayName || r.name)}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : (
          /* ─── 新建模式 ─── */
          <>
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">
                用户名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={createForm.username}
                onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="2-32 位字母、数字或下划线"
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">
                邮箱 <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="user@example.com"
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">
                初始密码 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={createForm.password}
                  onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="至少 6 个字符"
                  className="w-full px-3 py-1.5 pr-9 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  <Icon name={showPassword ? 'visibility_off' : 'visibility'} size={16} />
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-0.5 block">角色</label>
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]"
              >
                <option value="">选择角色...</option>
                {roles.map((r) => (
                  <option key={String(r.name)} value={String(r.name)}>
                    {String(r.displayName || r.name)}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <button
          onClick={save}
          disabled={saving}
          className="w-full py-2 text-sm bg-[#007AFF] text-white rounded-lg hover:bg-[#0066DD] transition-colors disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </Drawer>
  );
}
