import { useState, useMemo } from 'react';
import { Drawer } from '../../components/ui/Drawer';
import { authMgmtApi } from '../../../application/services/adminApi';

interface Props {
  open: boolean;
  roleName: string | null;
  roles: Record<string, unknown>[];
  onClose: () => void;
  onSaved: () => void;
}

const PERMISSION_CATALOG = [
  {
    group: '员工管理',
    permissions: ['employees.read', 'employees.write', 'employees.delete', 'employees.policy'],
  },
  {
    group: '技能管理',
    permissions: ['skills.read', 'skills.write', 'skills.delete', 'skills.approve'],
  },
  { group: '工具管理', permissions: ['tools.read', 'tools.write', 'tools.delete'] },
  { group: 'AI 网关', permissions: ['gateway.read', 'gateway.write', 'gateway.config'] },
  { group: '日志审计', permissions: ['logs.read', 'logs.export'] },
  {
    group: '通知管理',
    permissions: ['notifications.read', 'notifications.manage', 'notifications.channels'],
  },
  { group: '权限管理', permissions: ['auth.read', 'auth.write', 'auth.roles'] },
  { group: '系统配置', permissions: ['config.read', 'config.write'] },
];

export function AuthRoleDrawer({ open, roleName, roles, onClose, onSaved }: Props) {
  // 根据 open/roleName 派生初始值（渲染阶段计算，避免 useEffect 中 setState）
  const derived = useMemo(() => {
    if (open && roleName) {
      const role = roles.find((r) => String(r.name) === roleName);
      if (role) {
        return {
          name: String(role.name || ''),
          description: String(role.description || ''),
          permissions: new Set(
            Array.isArray(role.permissions) ? (role.permissions as string[]) : []
          ),
        };
      }
    }
    return { name: '', description: '', permissions: new Set<string>() };
  }, [open, roleName, roles]);

  const [name, setName] = useState(derived.name);
  const [description, setDescription] = useState(derived.description);
  const [permissions, setPermissions] = useState<Set<string>>(derived.permissions);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isEdit = !!roleName;

  // prop 变化时重置表单（React 渲染阶段 setState，非 effect）
  const [prevKey, setPrevKey] = useState({ open, roleName });
  if (open !== prevKey.open || roleName !== prevKey.roleName) {
    setPrevKey({ open, roleName });
    setName(derived.name);
    setDescription(derived.description);
    setPermissions(derived.permissions);
    setError('');
  }

  const togglePermission = (perm: string) => {
    setPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return next;
    });
  };

  const toggleGroup = (group: (typeof PERMISSION_CATALOG)[number]) => {
    const allSelected = group.permissions.every((p) => permissions.has(p));
    setPermissions((prev) => {
      const next = new Set(prev);
      group.permissions.forEach((p) => {
        if (allSelected) next.delete(p);
        else next.add(p);
      });
      return next;
    });
  };

  const save = async () => {
    if (!name.trim()) {
      setError('角色名不能为空');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const data = { name, description, permissions: Array.from(permissions) };
      if (isEdit) {
        await authMgmtApi.updateRole(roleName!, data);
      } else {
        await authMgmtApi.createRole(data);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(String((e as Error).message || '保存失败'));
    }
    setSaving(false);
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? '编辑角色' : '新建角色'}
      width="w-[480px]"
    >
      <div className="space-y-4">
        {error && (
          <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
        )}

        <div>
          <label className="text-xs text-gray-500 mb-0.5 block">角色名</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isEdit}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-0.5 block">描述</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20"
          />
        </div>

        <div>
          <h4 className="text-xs font-medium text-gray-500 mb-2">权限矩阵</h4>
          <div className="space-y-2">
            {PERMISSION_CATALOG.map((group) => {
              const allChecked = group.permissions.every((p) => permissions.has(p));
              const someChecked = group.permissions.some((p) => permissions.has(p));
              return (
                <div key={group.group} className="border border-gray-100 rounded-lg p-2">
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      ref={(el) => {
                        if (el) el.indeterminate = someChecked && !allChecked;
                      }}
                      onChange={() => toggleGroup(group)}
                      className="rounded border-gray-300"
                    />
                    {group.group}
                  </label>
                  <div className="flex flex-wrap gap-1 ml-5">
                    {group.permissions.map((perm) => (
                      <label
                        key={perm}
                        className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={permissions.has(perm)}
                          onChange={() => togglePermission(perm)}
                          className="rounded border-gray-300 w-3 h-3"
                        />
                        {perm.split('.')[1]}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-xs text-gray-400">已选 {permissions.size} 项权限</div>

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
