import { useState } from 'react';
import { employeeApi } from '../../../application/services/adminApi';
import type { InstanceScope } from '../../../domain/shared/types';
import { Modal } from '../../components/ui/Modal';
import { Icon } from '../../components/ui/Icon';

interface EmployeeCreateModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const RISK_LEVELS = [
  { value: 'L1', label: 'L1 — 低风险' },
  { value: 'L2', label: 'L2 — 中风险' },
  { value: 'L3', label: 'L3 — 高风险' },
  { value: 'L4', label: 'L4 — 极高风险' },
];

const ROLE_OPTIONS = [
  { value: 'operator', label: '操作员' },
  { value: 'dispatcher', label: '调度员' },
  { value: 'analyst', label: '分析师' },
  { value: 'reviewer', label: '审核员' },
  { value: 'assistant', label: '助理' },
  { value: 'specialist', label: '专员' },
  { value: 'engineer', label: '工程师' },
];

const inputCls =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF]';
const labelCls = 'block text-xs font-medium text-gray-600 mb-1';

export function EmployeeCreateModal({ open, onClose, onSuccess }: EmployeeCreateModalProps) {
  const [scope, setScope] = useState<InstanceScope>('organization');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState('operator');
  const [riskLevel, setRiskLevel] = useState('L2');
  const [ownerId, setOwnerId] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setScope('organization');
    setName('');
    setDepartment('');
    setRole('operator');
    setRiskLevel('L2');
    setOwnerId('');
    setDescription('');
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('请输入员工名称');
      return;
    }
    if (scope === 'personal' && !ownerId.trim()) {
      setError('个人级员工需要关联用户ID');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await employeeApi.create({
        name: trimmed,
        scope,
        department: department.trim(),
        role,
        riskLevel,
        ownerId: scope === 'personal' ? ownerId.trim() : undefined,
        description: description.trim(),
      });
      reset();
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="创建数字员工" width="max-w-lg">
      <div className="space-y-4">
        {/* 类型选择 */}
        <div className="flex gap-2">
          {(['organization', 'personal'] as InstanceScope[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setScope(s);
                setRiskLevel(s === 'personal' ? 'L1' : 'L2');
                setRole(s === 'personal' ? 'assistant' : 'operator');
              }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                scope === s
                  ? 'border-[#007AFF] bg-[#007AFF]/5 text-[#007AFF]'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <Icon name={s === 'organization' ? 'business' : 'person'} size={20} />
              <div className="text-left">
                <div className="text-sm font-medium">
                  {s === 'organization' ? '组织级' : '个人级'}
                </div>
                <div className="text-[11px] opacity-70">
                  {s === 'organization' ? '归属部门，共享使用' : '关联个人，专属助理'}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* 基本信息 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelCls}>员工名称 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：财务审核助理"
              className={inputCls}
            />
          </div>
          {scope === 'organization' && (
            <div>
              <label className={labelCls}>归属部门</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="例：finance"
                className={inputCls}
              />
            </div>
          )}
          <div>
            <label className={labelCls}>岗位角色</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>风险等级</label>
            <select
              value={riskLevel}
              onChange={(e) => setRiskLevel(e.target.value)}
              className={inputCls}
            >
              {RISK_LEVELS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          {scope === 'personal' && (
            <div className="col-span-2">
              <label className={labelCls}>关联用户ID *</label>
              <input
                type="text"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                placeholder="例：user_xxx 或 Matrix 用户ID"
                className={inputCls}
              />
            </div>
          )}
          <div className="col-span-2">
            <label className={labelCls}>职责描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简述该员工的工作职责..."
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        {error && (
          <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
        )}

        {/* 操作栏 */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-[#007AFF] rounded-lg hover:bg-[#0066DD] transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {loading ? (
              <>
                <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                创建中...
              </>
            ) : (
              <>
                <Icon name="add" size={16} />
                创建
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
