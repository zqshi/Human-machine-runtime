/**
 * SystemNotificationCards — 系统通知卡片集合 (stitch_11 + stitch_13 对齐)
 * PermissionApprovedCard: 权限申请已通过
 * PermissionRejectedCard: 权限申请已被驳回
 */
import { Icon } from '../../components/ui/Icon';

/* ─── 权限通过通知卡片 (stitch_11) ─── */

interface PermissionApprovedCardProps {
  docName?: string;
  approver?: string;
  time?: string;
  onEdit?: () => void;
  onViewDetail?: () => void;
}

export function PermissionApprovedCard({
  docName = '2024Q1_财务报表汇总',
  approver = 'Alice',
  time = '11:30',
  onEdit,
  onViewDetail,
}: PermissionApprovedCardProps) {
  return (
    <div className="max-w-sm mx-auto">
      <div className="rounded-2xl border border-border bg-bg-white-var p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
            <Icon name="check_circle" size={18} className="text-success" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">权限申请已通过</p>
            <p className="text-[10px] text-text-muted">你的编辑权限申请已通过</p>
          </div>
        </div>

        {/* Doc info */}
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-fill-tertiary/20">
          <Icon name="description" size={16} className="text-primary" />
          <div className="flex-1">
            <p className="text-xs font-medium text-text-primary">{docName}</p>
            <p className="text-[10px] text-text-muted">审批人: <span className="text-primary">{approver}</span> · {time}</p>
          </div>
        </div>

        {/* Actions */}
        <button
          type="button"
          onClick={onEdit}
          className="w-full py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 flex items-center justify-center gap-1.5"
        >
          <Icon name="edit" size={14} /> 立即编辑
        </button>
        <button
          type="button"
          onClick={onViewDetail}
          className="w-full text-center text-xs text-text-muted hover:text-primary"
        >
          查看申请详情
        </button>
      </div>
    </div>
  );
}

/* ─── 权限驳回通知卡片 (stitch_13) ─── */

interface PermissionRejectedCardProps {
  docName?: string;
  reason?: string;
  approver?: string;
  onRetry?: () => void;
  onContact?: () => void;
}

export function PermissionRejectedCard({
  docName = '2024Q1_财务报表汇总.xlsx',
  reason = '当前文档正在封版中，暂不支持编辑。请在 4月15日 归档后再行申请。',
  approver = 'Alice',
  onRetry,
  onContact,
}: PermissionRejectedCardProps) {
  return (
    <div className="max-w-sm mx-auto">
      <div className="rounded-2xl border border-border bg-bg-white-var p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-warning/10 flex items-center justify-center">
            <Icon name="warning" size={18} className="text-warning" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">权限申请已被驳回</p>
            <p className="text-[10px] text-text-muted">你的编辑权限申请已被拒绝，请核实原因后重新操作。</p>
          </div>
        </div>

        {/* Doc */}
        <div className="flex items-center gap-2 text-xs">
          <Icon name="description" size={14} className="text-text-muted" />
          <span className="text-text-secondary">申请项目:</span>
          <span className="text-text-primary font-medium">{docName}</span>
        </div>

        {/* Reject reason */}
        <div className="p-3 rounded-lg bg-warning/5 border border-warning/20">
          <div className="flex items-center gap-1 mb-1">
            <span className="px-1.5 py-0.5 text-[9px] font-medium text-warning bg-warning/10 rounded">驳回理由</span>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">{reason}</p>
        </div>

        {/* Approver */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-muted">审批人: <span className="text-text-primary">{approver}</span></span>
          <span className="text-text-muted">流程已闭环</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 flex items-center justify-center gap-1.5"
          >
            <Icon name="refresh" size={14} /> 再次申请
          </button>
          <button
            type="button"
            onClick={onContact}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-text-primary hover:bg-bg-hover flex items-center justify-center gap-1.5"
          >
            <Icon name="chat" size={14} /> 联系管理员
          </button>
        </div>
      </div>
    </div>
  );
}
