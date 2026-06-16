/**
 * DepartmentPermissionModal — 部门成员权限设置弹窗 (km_7 对齐)
 * 管理员列表 + 普通成员列表 + 权限下拉 + 添加维护者
 */
import { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Icon } from '../../components/ui/Icon';
import { Avatar } from '../../components/ui/Avatar';
import { useToastStore } from '../../../application/stores/toastStore';

type Permission = 'admin' | 'edit' | 'view';

interface Member {
  id: string;
  name: string;
  avatar: string;
  permission: Permission;
  isAdmin?: boolean;
}

const PERM_LABEL: Record<Permission, string> = {
  admin: '可管理',
  edit: '可编辑',
  view: '可查看',
};

interface DepartmentPermissionModalProps {
  open: boolean;
  onClose: () => void;
  departmentName?: string;
  admins?: Member[];
  members?: Member[];
}

export function DepartmentPermissionModal({
  open,
  onClose,
  departmentName = '财务部',
  admins = [],
  members = [],
}: DepartmentPermissionModalProps) {
  const [memberSearch, setMemberSearch] = useState('');
  const [permissions, setPermissions] = useState<Record<string, Permission>>({});

  const getPermission = (member: Member): Permission => permissions[member.id] ?? member.permission;
  const setPermission = (id: string, perm: Permission) =>
    setPermissions((prev) => ({ ...prev, [id]: perm }));

  const filteredAdmins = admins.filter((m) => !memberSearch || m.name.includes(memberSearch));
  const filteredMembers = members.filter((m) => !memberSearch || m.name.includes(memberSearch));

  return (
    <Modal open={open} onClose={onClose} title={`${departmentName}成员权限设置`} width="max-w-lg">
      {/* Search + Add */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 relative">
          <Icon
            name="search"
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            placeholder="搜索成员..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-bg-white-var focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <button
          type="button"
          onClick={() => useToastStore.getState().addToast('添加维护者功能开发中', 'info')}
          className="px-3 py-2 text-xs font-medium text-primary border border-primary rounded-lg hover:bg-primary/5 transition-colors whitespace-nowrap"
        >
          + 添加维护者
        </button>
      </div>

      {/* Admin list */}
      <section className="mb-4">
        <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
          部门管理员 ({filteredAdmins.length})
        </h4>
        <div className="space-y-1.5">
          {filteredAdmins.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              permission={getPermission(m)}
              onPermissionChange={(p) => setPermission(m.id, p)}
            />
          ))}
        </div>
      </section>

      {/* Regular members */}
      <section className="mb-5">
        <h4 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2">
          普通成员 ({filteredMembers.length})
        </h4>
        <div className="space-y-1.5">
          {filteredMembers.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              permission={getPermission(m)}
              onPermissionChange={(p) => setPermission(m.id, p)}
            />
          ))}
        </div>
      </section>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover rounded-lg transition-colors"
        >
          取消
        </button>
        <button
          type="button"
          onClick={() => {
            useToastStore.getState().addToast('权限设置已保存', 'success');
            onClose();
          }}
          className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
        >
          保存更改
        </button>
      </div>
    </Modal>
  );
}

function MemberRow({
  member,
  permission,
  onPermissionChange,
}: {
  member: Member;
  permission: Permission;
  onPermissionChange: (p: Permission) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bg-hover/50 transition-colors">
      <Avatar letter={member.avatar} size={32} />
      <span className="flex-1 text-sm font-medium text-text-primary">{member.name}</span>
      <select
        value={permission}
        onChange={(e) => onPermissionChange(e.target.value as Permission)}
        className="text-xs border border-border rounded-md px-2 py-1 bg-bg-white-var focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
      >
        <option value="admin">{PERM_LABEL.admin}</option>
        <option value="edit">{PERM_LABEL.edit}</option>
        <option value="view">{PERM_LABEL.view}</option>
      </select>
    </div>
  );
}
