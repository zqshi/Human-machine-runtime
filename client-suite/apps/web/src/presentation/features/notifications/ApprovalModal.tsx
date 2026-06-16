import { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { useNotificationStore } from '../../../application/stores/notificationStore';

const QUICK_REASONS = ['信息不全', '无权限访问', '流程不符'];

interface ApprovalModalProps {
  approvalId: string;
  open: boolean;
  onClose: () => void;
}

export function ApprovalModal({ approvalId, open, onClose }: ApprovalModalProps) {
  const [reason, setReason] = useState('');
  const rejectRequest = useNotificationStore((s) => s.rejectRequest);

  const handleReject = () => {
    if (!reason.trim()) return;
    rejectRequest(approvalId, reason.trim());
    setReason('');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="驳回申请">
      <div className="space-y-4">
        <p className="text-xs text-text-secondary">请填写驳回理由，该理由将同步给申请人</p>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">驳回理由</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="请输入驳回原因，例如：当前文档正在封版中..."
            rows={3}
            className="w-full rounded-lg border border-border bg-bg-white-var/60 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
          />
        </div>
        <div>
          <p className="text-[11px] text-text-muted mb-2">常用理由</p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className="px-2.5 py-1 rounded-full text-xs font-medium bg-fill-tertiary text-text-secondary hover:bg-fill-secondary transition-colors"
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button
            size="sm"
            className="bg-error hover:bg-[#E6352B] text-white shadow-none"
            disabled={!reason.trim()}
            onClick={handleReject}
          >
            确认驳回
          </Button>
        </div>
      </div>
    </Modal>
  );
}
