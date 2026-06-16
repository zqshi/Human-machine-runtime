import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { Button } from '../../components/ui/Button';
import { useNotificationStore } from '../../../application/stores/notificationStore';
import { ApprovalModal } from './ApprovalModal';
import type { Approval, ApprovalType, ApprovalStatus } from '../../../domain/notification/Approval';

const TYPE_LABELS: Record<ApprovalType, string> = {
  leave: '请假',
  expense: '报销',
  purchase: '采购',
  access: '权限',
};

const TYPE_ICONS: Record<ApprovalType, string> = {
  leave: 'event',
  expense: 'receipt_long',
  purchase: 'shopping_cart',
  access: 'vpn_key',
};

const STATUS_CONFIG: Record<ApprovalStatus, { label: string; color: string; bg: string }> = {
  pending: { label: '待审批', color: 'text-warning', bg: 'bg-warning/10' },
  approved: { label: '已通过', color: 'text-success', bg: 'bg-success/10' },
  rejected: { label: '已驳回', color: 'text-error', bg: 'bg-error/10' },
};

interface ApprovalCardProps {
  approval: Approval;
  onViewDetail?: () => void;
}

export function ApprovalCard({ approval, onViewDetail }: ApprovalCardProps) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const approveRequest = useNotificationStore((s) => s.approveRequest);
  const status = STATUS_CONFIG[approval.status];

  return (
    <>
      <div onClick={() => onViewDetail?.()} className="bg-bg-white-var/80 backdrop-blur-sm border border-border/60 rounded-xl p-4 transition-shadow hover:shadow-md cursor-pointer">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon name={TYPE_ICONS[approval.type]} size={18} className="text-text-secondary" />
            <span className="text-sm font-medium text-text-primary">{approval.applicant.name}</span>
            <span className="text-[10px] text-text-muted">{approval.applicant.department}</span>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.color} ${status.bg}`}>
            {TYPE_LABELS[approval.type]}
          </span>
        </div>

        {/* Body */}
        <p className="text-sm text-text-primary mb-1">{approval.title}</p>
        {approval.amount != null && (
          <p className="text-xs text-text-secondary mb-1">
            金额: <span className="font-medium text-text-primary">¥{approval.amount.toLocaleString()}</span>
          </p>
        )}
        {approval.reason && (
          <p className="text-xs text-text-muted mb-1">原因: {approval.reason}</p>
        )}
        <p className="text-[10px] text-text-muted">
          {new Date(approval.createdAt).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>

        {/* Actions */}
        {approval.isPending ? (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/40">
            <Button
              size="sm"
              className="bg-success hover:bg-[#2DB84D] text-white shadow-none flex-1"
              onClick={() => approveRequest(approval.id)}
            >
              通过
            </Button>
            <Button
              size="sm"
              className="bg-error hover:bg-[#E6352B] text-white shadow-none flex-1"
              onClick={() => setRejectOpen(true)}
            >
              驳回
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border/40">
            <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
          </div>
        )}
      </div>

      <ApprovalModal
        approvalId={approval.id}
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
      />
    </>
  );
}
