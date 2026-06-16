/**
 * AccessRestrictedModal — 访问受限弹窗 (km_11 对齐)
 * 权限不足提示 + 申请理由 + 选择审批人 + 发起申请
 */
import { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Icon } from '../../components/ui/Icon';

interface AccessRestrictedModalProps {
  open: boolean;
  onClose: () => void;
  targetName?: string;
  onSubmit?: (reason: string, approver: string) => void;
}

export function AccessRestrictedModal({
  open,
  onClose,
  targetName = '核心资产库',
  onSubmit,
}: AccessRestrictedModalProps) {
  const [reason, setReason] = useState('');
  const [approver, setApprover] = useState('选择部门负责人');

  const handleSubmit = () => {
    onSubmit?.(reason, approver);
    setReason('');
    setApprover('选择部门负责人');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex flex-col items-center mb-5">
        <div className="w-14 h-14 rounded-full bg-warning/10 flex items-center justify-center mb-3">
          <Icon name="lock" size={28} className="text-warning" />
        </div>
        <h3 className="text-lg font-bold text-text-primary">访问受限</h3>
        <p className="text-xs text-text-secondary mt-1.5 text-center leading-relaxed">
          你没有权限移动文件到"<span className="font-semibold text-text-primary">{targetName}</span>"。是否向管理员发起申请？
        </p>
      </div>

      {/* Reason */}
      <div className="mb-4">
        <label className="text-xs font-medium text-text-secondary mb-1.5 block">申请理由</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="请输入申请理由..."
          rows={4}
          className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-bg-white-var resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Approver select */}
      <div className="mb-5">
        <label className="text-xs font-medium text-text-secondary mb-1.5 block">选择审批人</label>
        <select value={approver} onChange={(e) => setApprover(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-bg-white-var focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none">
          <option>选择部门负责人</option>
          <option>陈萨拉 — 财务部负责人</option>
          <option>张晓明 — 财务部管理员</option>
        </select>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2.5 text-sm text-text-secondary hover:bg-bg-hover rounded-xl transition-colors"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="px-6 py-2.5 text-sm font-medium text-white bg-primary rounded-xl hover:bg-primary/90 transition-colors"
        >
          发起申请
        </button>
      </div>
    </Modal>
  );
}
