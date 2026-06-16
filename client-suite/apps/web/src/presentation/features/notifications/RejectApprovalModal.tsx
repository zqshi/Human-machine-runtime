/**
 * RejectApprovalModal — 驳回申请弹窗 (stitch_8 对齐)
 * 驳回理由输入 + 常用理由快捷标签 + 取消/确认驳回
 */
import { useState } from 'react';
import { Modal } from '../../components/ui/Modal';

const QUICK_REASONS = ['信息不全', '无权限访问', '流程不符'];

interface RejectApprovalModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm?: (reason: string) => void;
}

export function RejectApprovalModal({ open, onClose, onConfirm }: RejectApprovalModalProps) {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    onConfirm?.(reason);
    setReason('');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="text-center mb-4">
        <h3 className="text-[17px] font-semibold text-text-primary">驳回申请</h3>
        <p className="text-xs text-text-muted mt-1">请填写驳回理由，该理由将同步给申请人</p>
      </div>

      {/* Reason label */}
      <label className="text-xs font-medium text-text-secondary mb-1.5 block ml-1">驳回理由</label>

      {/* Textarea */}
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="请输入驳回原因，例如：当前文档正在封版中..."
        rows={4}
        className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-bg-white-var resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
      />

      {/* Quick reasons */}
      <div className="mt-3">
        <p className="text-[11px] text-text-muted mb-2">常用理由</p>
        <div className="flex items-center gap-2 flex-wrap">
          {QUICK_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className="px-3 py-1.5 text-xs rounded-full border border-border bg-black/5 text-text-secondary hover:bg-black/10 hover:border-primary hover:text-primary transition-colors"
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center mt-6 border-t border-border -mx-6 -mb-6">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-3.5 text-[15px] font-medium text-text-secondary hover:bg-bg-hover transition-colors rounded-bl-2xl"
        >
          取消
        </button>
        <div className="w-px bg-border h-12" />
        <button
          type="button"
          onClick={handleConfirm}
          className="flex-1 py-3.5 text-[15px] font-semibold text-primary hover:bg-primary/5 transition-colors rounded-br-2xl"
        >
          确认驳回
        </button>
      </div>
    </Modal>
  );
}
