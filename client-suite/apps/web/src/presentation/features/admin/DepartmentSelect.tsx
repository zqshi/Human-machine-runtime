import { useState, useEffect, useCallback } from 'react';
import { departmentApi, type Department } from '../../../application/services/adminApi';
import { useToastStore } from '../../../application/stores/toastStore';
import { Modal } from '../../components/ui/Modal';
import { Icon } from '../../components/ui/Icon';

interface Props {
  /** 当前选中的部门 ID（实体外键）。 */
  value?: string;
  /** 选中/新建后回调，同时返回实体 ID 与部门名称（文本列过渡保留）。 */
  onChange: (departmentId: string, departmentName?: string) => void;
  className?: string;
  placeholder?: string;
}

const selectCls =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]';

/**
 * 部门选择器（v3.0 部门实体化）。
 * 下拉列出当前租户部门 + 「新建」内联创建，输出 departmentId（实体）。
 */
export function DepartmentSelect({
  value,
  onChange,
  className,
  placeholder = '选择归属部门',
}: Props) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await departmentApi.list();
      setDepartments(list);
    } catch {
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    const name = createForm.name.trim();
    if (!name) {
      useToastStore.getState().addToast('请输入部门名称', 'info');
      return;
    }
    setCreating(true);
    try {
      const dept = await departmentApi.create({
        name,
        description: createForm.description.trim() || undefined,
      });
      useToastStore.getState().addToast('部门已创建', 'success');
      await load();
      onChange(dept.id, dept.name);
      setCreateOpen(false);
      setCreateForm({ name: '', description: '' });
    } catch (err) {
      useToastStore
        .getState()
        .addToast(`创建失败：${err instanceof Error ? err.message : '未知'}`, 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      <select
        value={value || ''}
        onChange={(e) => {
          const id = e.target.value;
          const dept = departments.find((d) => d.id === id);
          onChange(id, dept?.name);
        }}
        disabled={loading}
        className={`${selectCls} flex-1 ${value ? 'text-gray-800' : 'text-gray-400'}`}
      >
        <option value="">{loading ? '加载中...' : placeholder}</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        className="shrink-0 px-2.5 py-2 text-xs font-medium text-[#007AFF] border border-[#007AFF]/20 rounded-lg hover:bg-[#007AFF]/5 transition-colors flex items-center gap-1"
        title="新建部门"
      >
        <Icon name="add" size={14} />
        新建
      </button>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="新建部门" width="max-w-md">
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50/40 border border-emerald-100 text-xs text-emerald-700">
            <Icon name="info" size={14} className="shrink-0" />
            新建部门归属当前租户，可在同部门多个数字员工间共享记忆
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">部门名称 *</label>
            <input
              type="text"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              placeholder="例：财务部"
              className={selectCls}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">描述</label>
            <textarea
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              placeholder="部门职责简述（可选）"
              rows={2}
              className={`${selectCls} resize-none`}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setCreateOpen(false)}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-4 py-2 text-sm font-medium text-white bg-[#007AFF] rounded-lg hover:bg-[#0066DD] disabled:opacity-50"
            >
              {creating ? '创建中...' : '创建'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
