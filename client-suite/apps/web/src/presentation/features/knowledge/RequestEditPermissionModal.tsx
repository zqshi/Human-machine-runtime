/**
 * RequestEditPermissionModal — 申请编辑权限弹窗 (km_8 对齐)
 * 审批人列表 + 申请理由 + 发送申请/取消
 */
import { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Icon } from '../../components/ui/Icon';
import { Avatar } from '../../components/ui/Avatar';

interface Approver {
  name: string;
  avatar: string;
  role: string;
  online?: boolean;
}

interface RequestEditPermissionModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit?: (reason: string) => void;
  approvers?: Approver[];
}

export function RequestEditPermissionModal({
  open,
  onClose,
  onSubmit,
  approvers = [],
}: RequestEditPermissionModalProps) {
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    onSubmit?.(reason);
    setReason('');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex flex-col items-center mb-5">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <Icon name="edit_note" size={24} className="text-primary" />
        </div>
        <h3 className="text-lg font-bold text-text-primary">申请编辑权限</h3>
        <p className="text-xs text-text-muted mt-1">申请通过后，您将获得该文档的编辑与保存权限</p>
      </div>

      {/* Approver list */}
      <div className="mb-4">
        <p className="text-xs font-medium text-text-secondary mb-2">审批人 (部门管理员)</p>
        {approvers.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-3">暂无审批人</p>
        ) : (
          <div className="space-y-2">
            {approvers.map((a) => (
              <div
                key={a.name}
                className="flex items-center gap-3 p-3 rounded-xl bg-fill-tertiary/30"
              >
                <Avatar
                  letter={a.avatar}
                  size={36}
                  gradient="bg-gradient-to-br from-orange-400 to-amber-500"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-text-primary">{a.name}</span>
                  <p className="text-[11px] text-text-muted">{a.role}</p>
                </div>
                {a.online && (
                  <span className="text-[10px] text-success flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-success" />
                    在线
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reason */}
      <div className="mb-5">
        <p className="text-xs font-medium text-text-secondary mb-1.5">申请理由</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="请输入申请原因，如：需要更新Q1报表数据..."
          rows={4}
          className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-bg-white-var resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Actions */}
      <button
        type="button"
        onClick={handleSubmit}
        className="w-full py-3 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
      >
        发送申请
      </button>
      <button
        type="button"
        onClick={onClose}
        className="w-full py-2.5 text-sm text-text-secondary hover:text-text-primary transition-colors mt-2"
      >
        取消
      </button>
    </Modal>
  );
}
